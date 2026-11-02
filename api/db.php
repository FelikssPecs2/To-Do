<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$host = '127.0.0.1';
$db   = 'todo_app';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(['error' => 'DB connection failed']));
}

// Atgriež pašreizējā lietotāja ID
function currentUserId() {
    return $_SESSION['user_id'] ?? null;
}

// Pārbauda, vai lietotājs ir pieslēdzies
function requireLogin() {
    if (!currentUserId()) {
        http_response_code(401);
        out(['error' => 'Not logged in']);
    }
}

// Atgriež pašreizējā lietotāja lomu no datubāzes
function currentUserRole() {
    global $pdo;

    if (!currentUserId()) {
        return null;
    }

    $stmt = $pdo->prepare(
        "SELECT role FROM users WHERE id = ?"
    );
    $stmt->execute([currentUserId()]);

    return $stmt->fetchColumn() ?: null;
}

// Pārbauda, vai lietotājam ir atļautā loma
function requireRole(...$allowedRoles) {
    requireLogin();

    $role = currentUserRole();

    if (!$role || !in_array($role, $allowedRoles, true)) {
        http_response_code(403);
        out(['error' => 'Nav pietiekamu piekļuves tiesību.']);
    }
}

// Nolasa JSON pieprasījuma datus
function body() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

// Nosūta JSON atbildi
function out($data) {
    echo json_encode($data);
    exit;
}