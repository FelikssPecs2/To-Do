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
    if ($stmt->fetch()) out(['error' => 'Šis e-pasts jau ir reģistrēts.']);

    $hash = password_hash($pw, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)");
    $stmt->execute([$name, $email, $hash]);

    $_SESSION['user_id'] = (int)$pdo->lastInsertId();
    out(['ok' => true, 'id' => $_SESSION['user_id'], 'name' => $name]);
}

if ($action === 'login') {
    $d = body();
    $email = strtolower(trim($d['email'] ?? ''));
    $pw    = $d['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($pw, $user['password'])) {
        out(['error' => 'Nepareizs e-pasts vai parole.']);
    }

    $_SESSION['user_id'] = (int)$user['id'];
    out(['ok' => true, 'id' => $user['id'], 'name' => $user['name']]);
}

if ($action === 'logout') {
    session_destroy();
    out(['ok' => true]);
}

if ($action === 'me') {
    if (!currentUserId()) out(['user' => null]);
    $stmt = $pdo->prepare("SELECT id, name, email FROM users WHERE id = ?");
    $stmt->execute([currentUserId()]);
    out(['user' => $stmt->fetch()]);
}

out(['error' => 'Unknown action']);