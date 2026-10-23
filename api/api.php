<?php
header('Content-Type: application/json');

$apiKey = "4311295139479d3e2a1928699630d4e1";

if (isset($_GET['endpoint'])) {
    $endpoint = $_GET['endpoint'];
    $url = "";
    
    if ($endpoint === 'geo' && isset($_GET['q'])) {
        $q = urlencode($_GET['q']);
        $url = "https://api.openweathermap.org/geo/1.0/direct?q={$q}&limit=5&appid={$apiKey}";
    } 
    elseif ($endpoint === 'weather' && isset($_GET['q'])) {
        $q = urlencode($_GET['q']);
        $url = "https://api.openweathermap.org/data/2.5/weather?q={$q}&units=metric&appid={$apiKey}&lang=lv";
    } 
    elseif ($endpoint === 'weather' && isset($_GET['lat']) && isset($_GET['lon'])) {
        $lat = $_GET['lat'];
        $lon = $_GET['lon'];
        $url = "https://api.openweathermap.org/data/2.5/weather?lat={$lat}&lon={$lon}&units=metric&appid={$apiKey}&lang=lv";
    }

    if ($url !== "") {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        http_response_code($httpCode);
        echo $response;
        exit;
    }
}

http_response_code(400);
echo json_encode(['error' => 'Nederīgs pieprasījums']);