<?php
// Called by the digest app to record which videos were delivered
$secret = getenv('TRACKER_SECRET') ?: 'changeme';
if (($_SERVER['HTTP_X_TRACKER_SECRET'] ?? '') !== $secret) {
    http_response_code(403);
    exit('Forbidden');
}

$body      = file_get_contents('php://input');
$delivered = json_decode($body, true);
if (!is_array($delivered)) {
    http_response_code(400);
    exit('Invalid payload');
}

$logFile    = __DIR__ . '/data/deliveries.json';
$deliveries = file_exists($logFile) ? (json_decode(file_get_contents($logFile), true) ?? []) : [];

foreach ($delivered as $item) {
    $deliveries[] = [
        'ts'           => date('c'),
        'videoId'      => $item['videoId']      ?? '',
        'channelId'    => $item['channelId']     ?? '',
        'channelTitle' => $item['channelTitle']  ?? '',
        'videoTitle'   => $item['videoTitle']    ?? '',
    ];
}

file_put_contents($logFile, json_encode($deliveries, JSON_PRETTY_PRINT), LOCK_EX);
http_response_code(204);
