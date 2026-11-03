
<?php
require 'db.php';

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requireRole('admin', 'worker');

    $stmt = $pdo->query("
        SELECT
            o.*,
            u.name AS created_by_name
        FROM orders o
        JOIN users u ON o.created_by = u.id
        ORDER BY o.id DESC
    ");

    out(['orders' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    requireRole('admin', 'worker');

    $data = body();
    $items = $data['items'] ?? [];
    $notes = trim($data['notes'] ?? '');

    if (!is_array($items) || count($items) === 0) {
        http_response_code(400);
        out(['error' => 'Pasūtījumam jāpievieno vismaz viens produkts.']);
    }

    try {
        $pdo->beginTransaction();

        $orderNumber = 'ORD-' . date('YmdHis') . '-' . random_int(100, 999);

        $stmt = $pdo->prepare("
            INSERT INTO orders (order_number, created_by, notes)
            VALUES (?, ?, ?)
        ");

        $stmt->execute([
            $orderNumber,
            currentUserId(),
            $notes
        ]);

        $orderId = $pdo->lastInsertId();

        $itemStmt = $pdo->prepare("
            INSERT INTO order_items (order_id, product_id, quantity, unit_price)
            SELECT ?, id, ?, price
            FROM products
            WHERE id = ? AND status = 'active'
        ");

        foreach ($items as $item) {
            $productId = filter_var($item['product_id'] ?? null, FILTER_VALIDATE_INT);
            $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);

            if (!$productId || $quantity === false || $quantity <= 0) {
                throw new InvalidArgumentException('Nederīgi produkta dati.');
            }

            $itemStmt->execute([$orderId, $quantity, $productId]);

            if ($itemStmt->rowCount() !== 1) {
                throw new InvalidArgumentException('Produkts nav atrasts vai nav aktīvs.');
            }
        }

        $pdo->commit();

        out([
            'ok' => true,
            'message' => 'Pasūtījums izveidots.',
            'order_id' => $orderId,
            'order_number' => $orderNumber
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        http_response_code(400);
        out([
            'error' => $e instanceof InvalidArgumentException
                ? $e->getMessage()
                : 'Neizdevās izveidot pasūtījumu.'
        ]);
    }
}

if ($method === 'PUT') {
    requireRole('admin', 'worker');

    $data = body();

    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    $status = $data['status'] ?? '';

    $allowedStatuses = [
        'pending',
        'processing',
        'completed',
        'cancelled'
    ];

    if (!$id || !in_array($status, $allowedStatuses, true)) {
        http_response_code(400);
        out(['error' => 'Nederīgi pasūtījuma dati.']);
    }

    try {
        $pdo->beginTransaction();

        $orderStmt = $pdo->prepare("
            SELECT id, status
            FROM orders
            WHERE id = ?
            FOR UPDATE
        ");

        $orderStmt->execute([$id]);
        $order = $orderStmt->fetch();

        if (!$order) {
            throw new InvalidArgumentException('Pasūtījums nav atrasts.');
        }

        if ($order['status'] === 'completed' && $status !== 'completed') {
            throw new InvalidArgumentException('Pabeigta pasūtījuma statusu vairs nevar mainīt.');
        }

        if ($order['status'] !== 'completed' && $status === 'completed') {
            $itemsStmt = $pdo->prepare("
                SELECT
                    product_id,
                    SUM(quantity) AS quantity
                FROM order_items
                WHERE order_id = ?
                GROUP BY product_id
            ");

            $itemsStmt->execute([$id]);
            $items = $itemsStmt->fetchAll();

            foreach ($items as $item) {
                $productId = (int)$item['product_id'];
                $quantity = (int)$item['quantity'];

                $productStmt = $pdo->prepare("
                    SELECT quantity
                    FROM products
                    WHERE id = ?
                    FOR UPDATE
                ");

                $productStmt->execute([$productId]);
                $product = $productStmt->fetch();

                if (!$product || (int)$product['quantity'] < $quantity) {
                    throw new InvalidArgumentException('Nepietiekams produkta atlikums pasūtījuma pabeigšanai.');
                }

                $updateProduct = $pdo->prepare("
                    UPDATE products
                    SET quantity = quantity - ?
                    WHERE id = ?
                ");

                $updateProduct->execute([$quantity, $productId]);

                $locationStmt = $pdo->prepare("
                    SELECT id, quantity
                    FROM product_locations
                    WHERE product_id = ? AND quantity > 0
                    ORDER BY id
                    FOR UPDATE
                ");

                $locationStmt->execute([$productId]);
                $locationRows = $locationStmt->fetchAll();

                $remaining = $quantity;

                foreach ($locationRows as $location) {
                    if ($remaining <= 0) {
                        break;
                    }

                    $available = (int)$location['quantity'];
                    $deduct = min($available, $remaining);

                    $updateLocation = $pdo->prepare("
                        UPDATE product_locations
                        SET quantity = quantity - ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    ");

                    $updateLocation->execute([$deduct, $location['id']]);
                    $remaining -= $deduct;
                }

                $movement = $pdo->prepare("
                    INSERT INTO stock_movements
                        (product_id, user_id, movement_type, quantity, notes)
                    VALUES (?, ?, 'out', ?, ?)
                ");

                $movement->execute([
                    $productId,
                    currentUserId(),
                    $quantity,
                    'Pabeigts pasūtījums ' . $id
                ]);
            }
        }

        $updateOrder = $pdo->prepare("
            UPDATE orders
            SET status = ?
            WHERE id = ?
        ");

        $updateOrder->execute([$status, $id]);

        $pdo->commit();

        out(['ok' => true, 'message' => 'Pasūtījuma statuss atjaunināts.']);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        http_response_code(400);
        out([
            'error' => $e instanceof InvalidArgumentException
                ? $e->getMessage()
                : 'Neizdevās atjaunināt pasūtījuma statusu.'
        ]);
    }
}

if ($method === 'DELETE') {
    requireRole('admin');

    $data = body();
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);

    if (!$id) {
        http_response_code(400);
        out(['error' => 'Nederīgs pasūtījuma ID.']);
    }

    $check = $pdo->prepare("
        SELECT status
        FROM orders
        WHERE id = ?
    ");

    $check->execute([$id]);
    $order = $check->fetch();

    if (!$order) {
        http_response_code(404);
        out(['error' => 'Pasūtījums nav atrasts.']);
    }

    if ($order['status'] === 'completed') {
        http_response_code(409);
        out(['error' => 'Pabeigtu pasūtījumu nevar dzēst, jo tas jau ir ietekmējis noliktavas atlikumu.']);
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
        $stmt->execute([$id]);

        out(['ok' => true, 'message' => 'Pasūtījums dzēsts.']);
    } catch (PDOException $e) {
        http_response_code(409);
        out(['error' => 'Pasūtījumu nevar izdzēst.']);
    }
}

http_response_code(405);
out(['error' => 'Neatbalstīta pieprasījuma metode.']);
