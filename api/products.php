
<?php
require 'db.php';

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requireRole('admin', 'worker', 'organizer');

    $stmt = $pdo->query("
        SELECT *
        FROM products
        ORDER BY id DESC
    ");

    out(['products' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    requireRole('admin', 'worker');

    $data = body();

    $name = trim($data['name'] ?? '');
    $sku = trim($data['sku'] ?? '');
    $description = trim($data['description'] ?? '');
    $quantity = filter_var($data['quantity'] ?? 0, FILTER_VALIDATE_INT);
    $price = filter_var($data['price'] ?? 0, FILTER_VALIDATE_FLOAT);

    if ($name === '' || $sku === '' || $quantity === false ||
        $quantity < 0 || $price === false || $price < 0) {
        http_response_code(400);
        out(['error' => 'Nederīgi produkta dati.']);
    }

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            INSERT INTO products (name, sku, description, quantity, price)
            VALUES (?, ?, ?, ?, ?)
        ");

        $stmt->execute([$name, $sku, $description, $quantity, $price]);

        $productId = $pdo->lastInsertId();

        if ($quantity > 0) {
            $movement = $pdo->prepare("
                INSERT INTO stock_movements
                    (product_id, user_id, movement_type, quantity, notes)
                VALUES (?, ?, 'in', ?, ?)
            ");

            $movement->execute([
                $productId,
                currentUserId(),
                $quantity,
                'Sākotnējā produkta pievienošana'
            ]);
        }

        $pdo->commit();

        out([
            'ok' => true,
            'message' => 'Produkts pievienots.',
            'id' => $productId
        ]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        if ($e->getCode() === '23000') {
            http_response_code(409);
            out(['error' => 'Šāds SKU jau eksistē.']);
        }

        http_response_code(500);
        out(['error' => 'Neizdevās pievienot produktu.']);
    }
}

if ($method === 'PUT') {
    requireRole('admin', 'worker');

    $data = body();

    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    $name = trim($data['name'] ?? '');
    $sku = trim($data['sku'] ?? '');
    $description = trim($data['description'] ?? '');
    $quantity = filter_var($data['quantity'] ?? null, FILTER_VALIDATE_INT);
    $price = filter_var($data['price'] ?? null, FILTER_VALIDATE_FLOAT);

    if (!$id || $name === '' || $sku === '' ||
        $quantity === false || $quantity < 0 ||
        $price === false || $price < 0) {
        http_response_code(400);
        out(['error' => 'Nederīgi produkta dati.']);
    }

    try {
        $pdo->beginTransaction();

        $check = $pdo->prepare("
            SELECT quantity
            FROM products
            WHERE id = ?
            FOR UPDATE
        ");

        $check->execute([$id]);
        $oldProduct = $check->fetch();

        if (!$oldProduct) {
            $pdo->rollBack();
            http_response_code(404);
            out(['error' => 'Produkts nav atrasts.']);
        }

        $oldQuantity = (int)$oldProduct['quantity'];
        $difference = $quantity - $oldQuantity;

        $stmt = $pdo->prepare("
            UPDATE products
            SET name = ?, sku = ?, description = ?, quantity = ?, price = ?
            WHERE id = ?
        ");

        $stmt->execute([$name, $sku, $description, $quantity, $price, $id]);

        if ($difference !== 0) {
            $movementType = $difference > 0 ? 'in' : 'out';

            $movement = $pdo->prepare("
                INSERT INTO stock_movements
                    (product_id, user_id, movement_type, quantity, notes)
                VALUES (?, ?, ?, ?, ?)
            ");

            $movement->execute([
                $id,
                currentUserId(),
                $movementType,
                abs($difference),
                'Produkta daudzuma korekcija'
            ]);
        }

        $pdo->commit();

        out(['ok' => true, 'message' => 'Produkts atjaunināts.']);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        if ($e->getCode() === '23000') {
            http_response_code(409);
            out(['error' => 'Šāds SKU jau eksistē.']);
        }

        http_response_code(500);
        out(['error' => 'Neizdevās atjaunināt produktu.']);
    }
}

if ($method === 'DELETE') {
    requireRole('admin');

    $data = body();
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);

    if (!$id) {
        http_response_code(400);
        out(['error' => 'Nederīgs produkta ID.']);
    }

    $stmt = $pdo->prepare("
        UPDATE products
        SET status = 'inactive'
        WHERE id = ?
    ");

    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        out(['error' => 'Produkts nav atrasts vai jau ir neaktīvs.']);
    }

    out(['ok' => true, 'message' => 'Produkts deaktivizēts.']);
}

http_response_code(405);
out(['error' => 'Neatbalstīta pieprasījuma metode.']);
