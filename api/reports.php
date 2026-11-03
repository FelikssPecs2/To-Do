
<?php
require 'db.php';

requireLogin();
requireRole('admin', 'worker', 'organizer');

$role = currentUserRole();

$products = $pdo->query("
    SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(quantity), 0) AS total_quantity,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_products,
        COALESCE(SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END), 0) AS inactive_products
    FROM products
")->fetch();

$stock = $pdo->query("
    SELECT
        p.id,
        p.name,
        p.sku,
        p.quantity AS quantity,
        p.quantity AS total_quantity,
        COALESCE(SUM(pl.quantity), 0) AS located_quantity
    FROM products p
    LEFT JOIN product_locations pl ON p.id = pl.product_id
    GROUP BY p.id, p.name, p.sku, p.quantity
    ORDER BY p.name
")->fetchAll();

$locations = $pdo->query("
    SELECT
        wl.id,
        wl.zone,
        wl.shelf,
        COUNT(DISTINCT pl.product_id) AS product_count,
        COALESCE(SUM(pl.quantity), 0) AS quantity,
        COALESCE(SUM(pl.quantity), 0) AS total_quantity
    FROM warehouse_locations wl
    LEFT JOIN product_locations pl ON wl.id = pl.location_id
    GROUP BY wl.id, wl.zone, wl.shelf
    ORDER BY wl.zone, wl.shelf
")->fetchAll();

$locationStock = $pdo->query("
    SELECT
        wl.id AS location_id,
        wl.zone,
        wl.shelf,
        p.id AS product_id,
        p.name AS product_name,
        p.sku,
        COALESCE(pl.quantity, 0) AS quantity
    FROM warehouse_locations wl
    LEFT JOIN product_locations pl ON wl.id = pl.location_id
    LEFT JOIN products p ON pl.product_id = p.id
    ORDER BY wl.zone, wl.shelf, p.name
")->fetchAll();

$report = [
    'products' => $products,
    'stock' => $stock,
    'locations' => $locations,
    'location_stock' => $locationStock
];

if ($role === 'admin' || $role === 'worker') {
    $orders = $pdo->query("
        SELECT
            COUNT(*) AS total_orders,
            COALESCE(SUM(status = 'pending'), 0) AS pending_orders,
            COALESCE(SUM(status = 'processing'), 0) AS processing_orders,
            COALESCE(SUM(status = 'completed'), 0) AS completed_orders,
            COALESCE(SUM(status = 'cancelled'), 0) AS cancelled_orders
        FROM orders
    ")->fetch();

    $report['orders'] = $orders;

    $movements = $pdo->query("
        SELECT
            sm.id,
            p.name AS product_name,
            u.name AS user_name,
            sm.movement_type,
            sm.quantity,
            sm.notes,
            sm.created_at
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        JOIN users u ON sm.user_id = u.id
        ORDER BY sm.created_at DESC, sm.id DESC
        LIMIT 50
    ")->fetchAll();

    $report['stock_movements'] = $movements;
}

out($report);
