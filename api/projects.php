<?php
require 'db.php';
requireLogin();
$me = currentUserId();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];

        $stmt = $pdo->prepare("
            SELECT p.* FROM projects p
            JOIN project_members pm ON pm.project_id = p.id
            WHERE p.id = ? AND pm.user_id = ?
        ");
        $stmt->execute([$id, $me]);
        $project = $stmt->fetch();
        if (!$project) out(['error' => 'Projekts nav atrasts.']);

        $stmt = $pdo->prepare("
            SELECT u.id, u.name, u.email
            FROM users u
            JOIN project_members pm ON pm.user_id = u.id
            WHERE pm.project_id = ?
        ");
        $stmt->execute([$id]);
        $project['members'] = $stmt->fetchAll();

        $stmt = $pdo->prepare("
            SELECT t.*, u.name AS assignee_name
            FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
            WHERE t.project_id = ?
            ORDER BY t.done ASC, t.due IS NULL, t.due ASC
        ");
        $stmt->execute([$id]);
        $project['tasks'] = $stmt->fetchAll();

        out($project);
    }

    $stmt = $pdo->prepare("
        SELECT p.*,
            (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count,
            (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count,
            (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND done = 1) AS done_count
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = ?
    ");
    $stmt->execute([$me]);
    out($stmt->fetchAll());
}

if ($method === 'POST') {
    $d = body();
    if (empty($d['name'])) out(['error' => 'Nosaukums ir obligāts.']);

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("INSERT INTO projects (owner_id, name, description) VALUES (?, ?, ?)");
    $stmt->execute([$me, trim($d['name']), trim($d['description'] ?? '')]);
    $pid = (int)$pdo->lastInsertId();

    $pdo->prepare("INSERT INTO project_members (project_id, user_id) VALUES (?, ?)")
        ->execute([$pid, $me]);

    if (!empty($d['inviteEmail'])) {
        $email = strtolower(trim($d['inviteEmail']));
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($u = $stmt->fetch()) {
            $pdo->prepare("INSERT INTO invitations (project_id, user_id, invited_by) VALUES (?, ?, ?)")
                ->execute([$pid, $u['id'], $me]);
        }
    }

    $pdo->commit();
    out(['ok' => true, 'id' => $pid]);
}

out(['error' => 'Unknown method']);