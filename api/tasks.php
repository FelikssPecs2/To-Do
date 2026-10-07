<?php
require 'db.php';
requireLogin();
$me = currentUserId();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare("
        SELECT t.*, p.name AS project_name, u.name AS assignee_name
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u    ON u.id = t.assignee_id
        WHERE (t.project_id IS NULL AND t.user_id = ?) OR t.assignee_id = ?
        ORDER BY t.done ASC, t.due IS NULL, t.due ASC
    ");
    $stmt->execute([$me, $me]);
    out($stmt->fetchAll());
}

if ($method === 'POST') {
    $d = body();
    if (empty($d['title'])) out(['error' => 'Nosaukums ir obligāts.']);

    $stmt = $pdo->prepare("
        INSERT INTO tasks (user_id, project_id, assignee_id, title, description, due, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $me,
        !empty($d['projectId'])  ? (int)$d['projectId']  : null,
        !empty($d['assignee'])   ? (int)$d['assignee']   : null,
        trim($d['title']),
        trim($d['description'] ?? ''),
        !empty($d['due']) ? $d['due'] : null,
        $d['priority'] ?? 'Medium'
    ]);
    out(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
}

if ($method === 'PUT') {
    $d = body();
    $id = (int)($d['id'] ?? 0);

    $stmt = $pdo->prepare("SELECT * FROM tasks WHERE id = ?");
    $stmt->execute([$id]);
    $task = $stmt->fetch();
    if (!$task) out(['error' => 'Uzdevums nav atrasts.']);

    if ($task['project_id']) {
        $stmt = $pdo->prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?");
        $stmt->execute([$task['project_id'], $me]);
        if (!$stmt->fetch()) out(['error' => 'Nav tiesību.']);
    } elseif ($task['user_id'] != $me) {
        out(['error' => 'Nav tiesību.']);
    }

    $stmt = $pdo->prepare("
        UPDATE tasks
        SET title = ?, description = ?, due = ?, priority = ?, done = ?, assignee_id = ?
        WHERE id = ?
    ");
    $stmt->execute([
        trim($d['title']),
        trim($d['description'] ?? ''),
        !empty($d['due']) ? $d['due'] : null,
        $d['priority'] ?? 'Medium',
        !empty($d['done']) ? 1 : 0,
        !empty($d['assignee']) ? (int)$d['assignee'] : null,
        $id
    ]);
    out(['ok' => true]);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $me]);
    out(['ok' => true]);
}

out(['error' => 'Unknown method']);