<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
[$n, $x, $y] = [(int)$tok[0], (int)$tok[1], (int)$tok[2]];
// 品名（$tok[3 + 3i]）は使わない。単価 × 個数を足して小計を作る
$s = 0;
for ($i = 0; $i < $n; $i++) {
    $s += (int)$tok[4 + 3 * $i] * (int)$tok[5 + 3 * $i];
}
// クーポンは「X 円以上」で使える。割引後は 0 円で止める
$t = $s >= $x ? max($s - $y, 0) : $s;
// 税は整数で切り捨てる（PHP の / は浮動小数になるので intdiv を使う）
echo $t + intdiv($t * 10, 100), "\n";
