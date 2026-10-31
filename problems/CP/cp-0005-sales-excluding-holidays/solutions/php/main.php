<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$n = (int)$tok[0];
$q = (int)$tok[1];
// 累積和を 2 本: $ps[i] = 1..i 日目の営業日の売上合計、$pc[i] = 営業日数（PHP の整数は 64bit）
$ps = [0];
$pc = [0];
$s = $c = 0;
for ($i = 0; $i < $n; $i++) {
    $a = (int)$tok[2 + $i];
    if ($a >= 0) { // 休業日（-1）は足さない。売上 0 円の営業日は日数に数える
        $s += $a;
        $c++;
    }
    $ps[] = $s;
    $pc[] = $c;
}
$out = [];
$p = 2 + $n;
for ($j = 0; $j < $q; $j++) {
    $l = (int)$tok[$p];
    $r = (int)$tok[$p + 1];
    $p += 2;
    // 両端を含む L..R は「R までの和 − (L−1) までの和」
    $out[] = ($ps[$r] - $ps[$l - 1]) . ' ' . ($pc[$r] - $pc[$l - 1]);
}
echo implode("\n", $out), "\n";
