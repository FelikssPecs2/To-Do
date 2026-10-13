
<?php
require 'db.php';

$action = $_GET['action'] ?? '';

if ($action === 'register') {
    $d = body();
    $name  = trim($d['name'] ?? '');
    $email = strtolower(trim($d['email'] ?? ''));
    $pw    = $d['password'] ?? '';

    if ($name === '' || $email === '' || strlen($pw) < 8) {
        out(['error' => 'Visi lauki ir obligāti, parole vismaz 8 simboli.']);
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        out(['error' => 'Šis e-pasts jau ir reģistrēts.']);
    }

    $hash = password_hash($pw, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)"
    );
    $stmt->execute([$name, $email, $hash]);

    $_SESSION['user_id'] = (int)$pdo->lastInsertId();

    out([
        'ok' => true,
        'id' => $_SESSION['user_id'],
        'name' => $name
    ]);
}

if ($action === 'login') {
    $d = body();
    $email = strtolower(trim($d['email'] ?? ''));
    $pw = $d['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($pw, $user['password'])) {
        out(['error' => 'Nepareizs e-pasts vai parole.']);
    }

    $_SESSION['user_id'] = (int)$user['id'];

    out([
        'ok' => true,
        'id' => $user['id'],
        'name' => $user['name']
    ]);
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();

    out(['ok' => true]);
}

if ($action === 'me') {
    if (!currentUserId()) {
        out(['user' => null]);
    }

    $stmt = $pdo->prepare(
        "SELECT id, name, email FROM users WHERE id = ?"
    );
    $stmt->execute([currentUserId()]);

    out(['user' => $stmt->fetch()]);
}


if ($action === 'delete-account') {
    requireLogin();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        out(['error' => 'Nepareiza pieprasījuma metode.']);
    }

    $me = currentUserId();

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare(
            "SELECT id FROM projects WHERE owner_id = ?"
        );
        $stmt->execute([$me]);

        $ownedProjects = $stmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($ownedProjects as $projectId) {
            $pdo->prepare(
                "DELETE FROM tasks WHERE project_id = ?"
            )->execute([$projectId]);

            $pdo->prepare(
                "DELETE FROM invitations WHERE project_id = ?"
            )->execute([$projectId]);

            $pdo->prepare(
                "DELETE FROM project_members WHERE project_id = ?"
            )->execute([$projectId]);

            $pdo->prepare(
                "DELETE FROM projects WHERE id = ?"
            )->execute([$projectId]);
        }

        $pdo->prepare(
            "DELETE FROM tasks WHERE user_id = ? OR assignee_id = ?"
        )->execute([$me, $me]);


        $pdo->prepare(
            "DELETE FROM invitations WHERE user_id = ? OR invited_by = ?"
        )->execute([$me, $me]);

      
        $pdo->prepare(
            "DELETE FROM project_members WHERE user_id = ?"
        )->execute([$me]);

   
        $pdo->prepare(
            "DELETE FROM users WHERE id = ?"
        )->execute([$me]);

        $pdo->commit();

        $_SESSION = [];
        session_destroy();

        out(['ok' => true]);

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log('Account deletion failed: ' . $e->getMessage());

        http_response_code(500);
        out([
            'error' => 'Neizdevās dzēst kontu. Pārbaudi datubāzes saites.'
        ]);
    }
}

out(['error' => 'Unknown action']);