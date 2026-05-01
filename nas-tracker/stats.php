<?php
$secret = getenv('TRACKER_SECRET') ?: 'changeme';
if (($_GET['key'] ?? '') !== $secret) {
    http_response_code(403);
    exit('Forbidden — add ?key=YOUR_TRACKER_SECRET to the URL');
}

$clickFile    = __DIR__ . '/data/clicks.json';
$deliveryFile = __DIR__ . '/data/deliveries.json';
$clicks       = file_exists($clickFile)    ? (json_decode(file_get_contents($clickFile),    true) ?? []) : [];
$deliveries   = file_exists($deliveryFile) ? (json_decode(file_get_contents($deliveryFile), true) ?? []) : [];

// Build per-channel stats
$channels = [];

foreach ($deliveries as $d) {
    $id = $d['channelId'];
    if (!isset($channels[$id])) {
        $channels[$id] = ['title' => $d['channelTitle'], 'delivered' => 0, 'clicks' => 0, 'lastClick' => null];
    }
    $channels[$id]['delivered']++;
}

foreach ($clicks as $c) {
    $id = $c['channelId'];
    if (!isset($channels[$id])) {
        $channels[$id] = ['title' => $c['channelTitle'], 'delivered' => 0, 'clicks' => 0, 'lastClick' => null];
    }
    $channels[$id]['clicks']++;
    $ts = strtotime($c['ts']);
    if ($channels[$id]['lastClick'] === null || $ts > strtotime($channels[$id]['lastClick'])) {
        $channels[$id]['lastClick'] = $c['ts'];
    }
}

// Sort by days since last click descending (worst engagement first)
uasort($channels, function ($a, $b) {
    $aTs = $a['lastClick'] ? strtotime($a['lastClick']) : 0;
    $bTs = $b['lastClick'] ? strtotime($b['lastClick']) : 0;
    return $aTs <=> $bTs;
});

$now = time();

function daysSince($ts) {
    global $now;
    if (!$ts) return null;
    return (int)(($now - strtotime($ts)) / 86400);
}

function statusBadge($lastClick, $clicks) {
    if ($clicks === 0)             return ['🔴', '#fee2e2', 'Never clicked'];
    $d = daysSince($lastClick);
    if ($d > 60)                   return ['🔴', '#fee2e2', $d . 'd ago'];
    if ($d > 30)                   return ['🟡', '#fef9c3', $d . 'd ago'];
    return                                ['🟢', '#dcfce7', $d . 'd ago'];
}

$filterDays = isset($_GET['filter']) ? (int)$_GET['filter'] : 0;
$keyParam   = '?key=' . urlencode($secret);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>YouTube Digest — Engagement Stats</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f3f4f6; margin: 0; padding: 24px 16px; color: #111827; }
    .wrap { max-width: 860px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .sub { font-size: 14px; color: #6b7280; margin-bottom: 24px; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
    .filters a { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
                 text-decoration: none; background: #e5e7eb; color: #374151; }
    .filters a.active { background: #111827; color: #fff; }
    table { width: 100%; border-collapse: collapse; background: #fff;
            border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    th { background: #f9fafb; font-size: 12px; font-weight: 600; color: #6b7280;
         text-transform: uppercase; letter-spacing: .5px; padding: 10px 16px; text-align: left; }
    td { padding: 12px 16px; border-top: 1px solid #f3f4f6; font-size: 14px; }
    tr:hover td { background: #fafafa; }
    .rate { font-weight: 600; }
    .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .summary { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .card { background: #fff; border-radius: 8px; padding: 16px 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,.08); flex: 1; min-width: 140px; }
    .card .n { font-size: 28px; font-weight: 800; }
    .card .l { font-size: 13px; color: #6b7280; margin-top: 2px; }
  </style>
</head>
<body>
<div class="wrap">
  <h1>YouTube Digest — Engagement Stats</h1>
  <div class="sub">Generated <?= date('F j, Y') ?> · Channels sorted by least recent click first</div>

  <?php
    $totalChannels  = count($channels);
    $neverClicked   = count(array_filter($channels, function($c) { return $c['clicks'] === 0; }));
    $inactive30     = count(array_filter($channels, function($c) { return $c['clicks'] > 0 && daysSince($c['lastClick']) > 30; }));
    $totalClicks    = array_sum(array_column($channels, 'clicks'));
  ?>
  <div class="summary">
    <div class="card"><div class="n"><?= $totalChannels ?></div><div class="l">Channels tracked</div></div>
    <div class="card"><div class="n"><?= $totalClicks ?></div><div class="l">Total clicks</div></div>
    <div class="card"><div class="n" style="color:#ef4444"><?= $neverClicked ?></div><div class="l">Never clicked</div></div>
    <div class="card"><div class="n" style="color:#f59e0b"><?= $inactive30 ?></div><div class="l">Inactive &gt;30 days</div></div>
  </div>

  <div class="filters">
    <a href="<?= $keyParam ?>" class="<?= $filterDays === 0 ? 'active' : '' ?>">All</a>
    <a href="<?= $keyParam ?>&filter=30" class="<?= $filterDays === 30 ? 'active' : '' ?>">Inactive &gt;30d</a>
    <a href="<?= $keyParam ?>&filter=60" class="<?= $filterDays === 60 ? 'active' : '' ?>">Inactive &gt;60d</a>
    <a href="<?= $keyParam ?>&filter=90" class="<?= $filterDays === 90 ? 'active' : '' ?>">Inactive &gt;90d</a>
    <a href="<?= $keyParam ?>&filter=9999" class="<?= $filterDays === 9999 ? 'active' : '' ?>">Never clicked</a>
  </div>

  <table>
    <thead>
      <tr>
        <th>Channel</th>
        <th>Delivered</th>
        <th>Clicks</th>
        <th>Click Rate</th>
        <th>Last Click</th>
      </tr>
    </thead>
    <tbody>
    <?php foreach ($channels as $id => $ch):
        $days = $ch['lastClick'] ? daysSince($ch['lastClick']) : null;
        if ($filterDays > 0) {
            if ($filterDays === 9999 && $ch['clicks'] > 0) continue;
            if ($filterDays !== 9999 && ($ch['clicks'] === 0 || $days === null || $days <= $filterDays)) continue;
        }
        list($emoji, $bg, $label) = statusBadge($ch['lastClick'], $ch['clicks']);
        $rate = $ch['delivered'] > 0 ? round($ch['clicks'] / $ch['delivered'] * 100) : 0;
    ?>
      <tr>
        <td><?= htmlspecialchars($ch['title']) ?></td>
        <td><?= $ch['delivered'] ?></td>
        <td><?= $ch['clicks'] ?></td>
        <td class="rate"><?= $ch['delivered'] > 0 ? $rate . '%' : '—' ?></td>
        <td><span class="badge" style="background:<?= $bg ?>"><?= $emoji ?> <?= $label ?></span></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
</body>
</html>
