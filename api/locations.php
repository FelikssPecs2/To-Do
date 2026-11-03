
<?php
require 'db.php';

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requireRole('admin', 'worker', 'organizer');

    $stmt = $pdo->query("
        SELECT
            wl.id AS location_id,
            wl.zone,
            wl.shelf,
            wl.description,
            pl.id AS product_location_id,
            p.id AS product_id,
            p.name AS product_name,
            p.sku,
            COALESCE(pl.quantity, 0) AS quantity,
            pl.updated_at
        FROM warehouse_locations wl
        LEFT JOIN product_locations pl ON wl.id = pl.location_id
        LEFT JOIN products p ON pl.product_id = p.id
        ORDER BY wl.zone, wl.shelf, p.name
    ");

    out(['locations' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    requireRole('admin');

    $data = body();

    $zone = trim($data['zone'] ?? '');
    $shelf = trim($data['shelf'] ?? '');
    $description = trim($data['description'] ?? '');

    if ($zone === '' || $shelf === '') {
        http_response_code(400);
        out(['error' => 'Zona un plaukts ir obligāti.']);
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO warehouse_locations (zone, shelf, description)
            VALUES (?, ?, ?)
        ");

        $stmt->execute([$zone, $shelf, $description]);

        out([
            'ok' => true,
            'message' => 'Plaukts pievienots.',
            'id' => $pdo->lastInsertId()
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(409);
            out(['error' => 'Šāda atrašanās vieta jau eksistē.']);
        }

        http_response_code(500);
        out(['error' => 'Neizdevās pievienot plauktu.']);
    }
}

if ($method === 'PUT') {
    requireRole('admin', 'organizer');

    $data = body();

    $productId = filter_var($data['product_id'] ?? null, FILTER_VALIDATE_INT);
    $locationId = filter_var($data['location_id'] ?? null, FILTER_VALIDATE_INT);
    $quantity = filter_var($data['quantity'] ?? null, FILTER_VALIDATE_INT);

    if (!$productId || !$locationId || $quantity === false || $quantity < 0) {
        http_response_code(400);
        out(['error' => 'Nederīgi atrašanās vietas dati.']);
    }

    $stmt = $pdo->prepare("
        INSERT INTO product_locations (product_id, location_id, quantity)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            quantity = VALUES(quantity),
            updated_at = CURRENT_TIMESTAMP
    ");

    $stmt->execute([$productId, $locationId, $quantity]);

    out(['ok' => true, 'message' => 'Produkta atrašanās vieta atjaunināta.']);
}

http_response_code(405);
out(['error' => 'Neatbalstīta pieprasījuma metode.']);
