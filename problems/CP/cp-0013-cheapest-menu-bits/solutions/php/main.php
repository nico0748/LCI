<?php
$tok = array_map('intval', preg_split('/\s+/', trim(stream_get_contents(STDIN))));
$p = 0;
$n = $tok[$p++];
$m = $tok[$p++];
$price = [];
$mask = [];
for ($i = 0; $i < $n; $i++) {
    $price[$i] = $tok[$p++];
    $k = $tok[$p++];
    $b = 0;
    for ($j = 0; $j < $k; $j++) $b |= 1 << ($tok[$p++] - 1); // 栄養 a をビット a-1 に
    $mask[$i] = $b;
}
$full = (1 << $m) - 1;
$size = 1 << $n;
$cover = array_fill(0, $size, 0); // 集合 s の栄養の OR
$cost = array_fill(0, $size, 0);  // 集合 s の合計（PHP の int は 64bit）
$best = -1;
$ways = 0;
for ($s = 1; $s < $size; $s++) {
    $low = $s & -$s; // 最下位の 1 ビット = 番号が最小の料理
    $i = strlen(decbin($low)) - 1;
    $cover[$s] = $cover[$s ^ $low] | $mask[$i];
    $cost[$s] = $cost[$s ^ $low] + $price[$i];
    if ($cover[$s] === $full) {
        if ($best === -1 || $cost[$s] < $best) {
            $best = $cost[$s];
            $ways = 1;
        } elseif ($cost[$s] === $best) {
            $ways++;
        }
    }
}
echo $best === -1 ? "-1\n" : "$best $ways\n";
