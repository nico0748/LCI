<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$n = (int)$tok[0];
$m = (int)$tok[1];
$adj = array_fill(0, $n + 1, []);
$indeg = array_fill(0, $n + 1, 0);
for ($i = 0; $i < $m; $i++) {
    $u = (int)$tok[2 + 2 * $i];
    $v = (int)$tok[3 + 2 * $i];
    $adj[$u][] = $v;  // 重複した辺もそのまま（入次数も同じ回数だけ数える）
    $indeg[$v]++;
}
// 段ごとの Kahn 法
$cur = [];
for ($v = 1; $v <= $n; $v++) {
    if ($indeg[$v] === 0) $cur[] = $v;
}
$counts = [];
$done = 0;
while ($cur) {
    $counts[] = count($cur);
    $done += count($cur);
    $next = [];
    foreach ($cur as $u) {
        foreach ($adj[$u] as $v) {
            if (--$indeg[$v] === 0) $next[] = $v;
        }
    }
    $cur = $next;
}
if ($done < $n) {
    echo "-1\n";
} else {
    echo count($counts), "\n", implode(' ', $counts), "\n";
}
