<?php
require 'db.php';
requireLogin();

// Return members of a project (if ?project=ID), otherwise all users
$projectId = isset($_GET['project']) ? (int)$_GET['project'] : null;

if ($projectId) {
    // Security: only members of the project can see its member list
    $stmt = $pdo->prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?");
    $stmt->execute([$projectId, currentUserId()]);
    if (!$stmt->fetch()) out(['error' => 'Nav tiesību.']);

    $stmt = $pdo->prepare("
        SELECT u.id, u.name, u.email
        FROM users u
        JOIN project_members pm ON pm.user_id = u.id
        WHERE pm.project_id = ?
    ");
    $stmt->execute([$projectId]);
    out($stmt->fetchAll());
}

// fallback: all users (used only in non-sensitive places)
$stmt = $pdo->query("SELECT id, name, email FROM users");
out($stmt->fetchAll());