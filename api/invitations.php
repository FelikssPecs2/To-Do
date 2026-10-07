<?php
require 'db.php';
requireLogin();
$me = currentUserId();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare("
        SELECT i.*, p.name AS project_name, u.name AS sender_name
        FROM invitations i
        JOIN projects p ON p.id = i.project_id
        JOIN users u    ON u.id = i.invited_by
        WHERE i.user_id = ? AND i.status = 'pending'
    ");
    $stmt->execute([$me]);
    out($stmt->fetchAll());
}

if ($method === 'POST') {
    $d = body();
    $action = $d['action'] ?? '';

    // Create a new invitation (project owner only)
    if ($action === 'create') {
        $projectId = (int)($d['projectId'] ?? 0);
        $email = strtolower(trim($d['email'] ?? ''));

        $stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ? AND owner_id = ?");
        $stmt->execute([$projectId, $me]);
        if (!$stmt->fetch()) out(['error' => 'Nav tiesību.']);

        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user) out(['error' => 'Lietotājs ar šādu e-pastu nav reģistrēts.']);

        $stmt = $pdo->prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?");
        $stmt->execute([$projectId, $user['id']]);
        if ($stmt->fetch()) out(['error' => 'Šis lietotājs jau ir projekta dalībnieks.']);

        $stmt = $pdo->prepare("SELECT 1 FROM invitations WHERE project_id = ? AND user_id = ? AND status = 'pending'");
        $stmt->execute([$projectId, $user['id']]);
        if ($stmt->fetch()) out(['error' => 'Uzaicinājums jau ir nosūtīts.']);

        $pdo->prepare("INSERT INTO invitations (project_id, user_id, invited_by) VALUES (?, ?, ?)")
            ->execute([$projectId, $user['id'], $me]);
        out(['ok' => true]);
    }

    // Accept / decline existing invitation
    $id = (int)($d['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM invitations WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $me]);
    $inv = $stmt->fetch();
    if (!$inv) out(['error' => 'Uzaicinājums nav atrasts.']);

    if ($action === 'accept') {
        $pdo->prepare("INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)")
            ->execute([$inv['project_id'], $me]);
        $pdo->prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?")
            ->execute([$id]);
        out(['ok' => true]);
    }

    if ($action === 'decline') {
        $pdo->prepare("UPDATE invitations SET status = 'declined' WHERE id = ?")
            ->execute([$id]);
        out(['ok' => true]);
    }

    out(['error' => 'Nezināma darbība.']);
}

out(['error' => 'Unknown method']);