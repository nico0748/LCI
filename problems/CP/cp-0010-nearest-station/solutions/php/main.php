<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$n = (int)$tok[0];
$q = (int)$tok[1];
$xs = array_map('intval', array_slice($tok, 2, $n));
sort($xs); // 整数の配列なので数値順

$out = [];
for ($j = 0; $j < $q; $j++) {
    $h = (int)$tok[2 + $n + $j];
    // lower_bound: $xs[$lo] は h 以上で最小の駅（$lo === $n なら無い）
    $lo = 0;
    $hi = $n;
    while ($lo < $hi) {
        $mid = ($lo + $hi) >> 1;
        if ($xs[$mid] < $h) {
            $lo = $mid + 1;
        } else {
            $hi = $mid;
        }
    }
    // 最寄りは $xs[$lo]（h 以上）か $xs[$lo − 1]（h 未満）。端では片方だけ
    if ($lo === 0) {
        $out[] = $xs[0] - $h;
    } elseif ($lo === $n) {
        $out[] = $h - $xs[$n - 1];
    } else {
        $out[] = min($xs[$lo] - $h, $h - $xs[$lo - 1]);
    }
}
echo implode("\n", $out), "\n";
