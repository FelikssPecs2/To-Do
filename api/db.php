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
    die(json_encode(['error' => 'DB connection failed: ' . $e->getMessage()]));
}

function currentUserId() { return $_SESSION['user_id'] ?? null; }

function requireLogin() {
    if (!currentUserId()) {
        http_response_code(401);
        die(json_encode(['error' => 'Not logged in']));
    }
}

function body() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function out($data) {
    echo json_encode($data);
    exit;
}