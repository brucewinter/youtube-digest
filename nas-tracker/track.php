<?php
// Validate secret to prevent external spam
$secret = getenv('TRACKER_SECRET') ?: 'changeme';
if (($_GET['sig'] ?? '') !== $secret) {
    http_response_code(403);
    exit('Forbidden');
}

$videoId      = $_GET['v']   ?? '';
$channelId    = $_GET['ch']  ?? '';
$channelTitle = $_GET['ct']  ?? '';
$videoTitle   = $_GET['vt']  ?? '';
$redirectUrl  = $_GET['url'] ?? '';

// Only allow redirects to YouTube
if (!preg_match('#^https://(www\.)?youtube\.com/#', $redirectUrl)) {
    http_response_code(400);
    exit('Invalid redirect');
}

// Append click
$logFile = __DIR__ . '/data/clicks.json';
$clicks  = file_exists($logFile) ? (json_decode(file_get_contents($logFile), true) ?? []) : [];
$clicks[] = [
    'ts'           => date('c'),
    'videoId'      => $videoId,
    'channelId'    => $channelId,
    'channelTitle' => $channelTitle,
    'videoTitle'   => $videoTitle,
];
file_put_contents($logFile, json_encode($clicks, JSON_PRETTY_PRINT), LOCK_EX);

header('Location: ' . $redirectUrl, true, 302);
exit;
