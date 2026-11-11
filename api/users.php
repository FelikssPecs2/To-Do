<?php
require 'db.php';

requireLogin();
requireRole('admin');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT id, name, email, role, created_at
        FROM users
        ORDER BY created_at DESC
    ");

    out([
        'users' => $stmt->fetchAll(PDO::FETCH_ASSOC)
    ]);
}

if ($method === 'PUT') {
    $data = body();
    $id = (int)($data['id'] ?? 0);
    $role = $data['role'] ?? '';
    $currentUserId = (int)currentUserId();

    $allowedRoles = ['admin', 'worker', 'organizer'];

    if ($id <= 0 || !in_array($role, $allowedRoles, true)) {
        out(['error' => 'Nederīgi dati'], 400);
    }

    if ($id === $currentUserId) {
        out(['error' => 'Nevari mainīt sava konta lomu'], 400);
    }

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            SELECT id, role
            FROM users
            WHERE id = ?
            FOR UPDATE
        ");
        $stmt->execute([$id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            $pdo->rollBack();
            out(['error' => 'Lietotājs nav atrasts'], 404);
        }

        if ($user['role'] === 'admin' && $role !== 'admin') {
            $stmt = $pdo->query("
                SELECT COUNT(*)
                FROM users
                WHERE role = 'admin'
                FOR UPDATE
            ");

            $adminCount = (int)$stmt->fetchColumn();

            if ($adminCount <= 1) {
                $pdo->rollBack();
                out(['error' => 'Nevar pazemināt pēdējo administratoru'], 400);
            }
        }

        $stmt = $pdo->prepare("
            UPDATE users
            SET role = ?
            WHERE id = ?
        ");
        $stmt->execute([$role, $id]);

        $pdo->commit();

        out([
            'success' => true,
            'message' => 'Lietotāja loma veiksmīgi nomainīta'
        ]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        out(['error' => 'Neizdevās nomainīt lietotāja lomu'], 500);
    }
}

if ($method === 'DELETE') {
    $data = body();
    $id = (int)($data['id'] ?? 0);
    $currentUserId = (int)currentUserId();

    if ($id <= 0) {
        out(['error' => 'Nederīgs lietotāja ID'], 400);
    }

    if ($id === $currentUserId) {
        out(['error' => 'Nevari izdzēst savu kontu'], 400);
    }

    $stmt = $pdo->prepare("
        SELECT id, role
        FROM users
        WHERE id = ?
    ");
    $stmt->execute([$id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        out(['error' => 'Lietotājs nav atrasts'], 404);
    }

    if ($user['role'] === 'admin') {
        $stmt = $pdo->query("
            SELECT COUNT(*)
            FROM users
            WHERE role = 'admin'
        ");

        $adminCount = (int)$stmt->fetchColumn();

        if ($adminCount <= 1) {
            out(['error' => 'Nevar izdzēst pēdējo administratoru'], 400);
        }
    }

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            DELETE FROM users
            WHERE id = ?
        ");
        $stmt->execute([$id]);

        $pdo->commit();

        out([
            'success' => true,
            'message' => 'Lietotājs veiksmīgi izdzēsts'
        ]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        out([
            'error' => 'Lietotāju nevar izdzēst. Iespējams, ar šo kontu ir saistīti citi dati.'
        ], 500);
    }
}

out(['error' => 'Neatbalstīta metode'], 405);