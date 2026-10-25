<?php
$tok = array_map('intval', preg_split('/\s+/', trim(stream_get_contents(STDIN))));
$q = $tok[0];
$n = 1;
for ($i = 0; $i < $q; $i++) if ($tok[2 + 2 * $i] > $n) $n = $tok[2 + 2 * $i];
// エラトステネスの篩を文字列で持つ（"1" = 素数）。0 と 1 は素数でない
$isP = str_repeat('1', $n + 1);
$isP[0] = '0';
$isP[1] = '0';
for ($i = 2; $i * $i <= $n; $i++) {
    if ($isP[$i] === '1') {
        for ($j = $i * $i; $j <= $n; $j += $i) $isP[$j] = '0';
    }
}
// pre[x] = 1..x の素数の個数。[L, R] の個数は pre[R] - pre[L-1]
$pre = array_fill(0, $n + 1, 0);
$acc = 0;
for ($x = 1; $x <= $n; $x++) {
    if ($isP[$x] === '1') $acc++;
    $pre[$x] = $acc;
}
$out = [];
for ($i = 0; $i < $q; $i++) $out[] = $pre[$tok[2 + 2 * $i]] - $pre[$tok[1 + 2 * $i] - 1];
echo implode("\n", $out), "\n";
