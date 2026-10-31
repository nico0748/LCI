<?php
const P = 998244353;

function power(int $a, int $e): int
{
    $r = 1;
    $a %= P;
    while ($e > 0) {
        if ($e & 1) {
            $r = $r * $a % P;
        }
        $a = $a * $a % P;
        $e >>= 1;
    }
    return $r;
}

$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$q = (int)$tok[0];
$m = 0;
for ($i = 0; $i < $q; $i++) {
    $m = max($m, (int)$tok[1 + 2 * $i]);
}
// 階乗と、その逆元（フェルマーの小定理: a^(P−2)）を n の最大値まで前計算する
// PHP の整数は 64bit で、P^2 < 2^63 なので $a * $b % P は float に化けずに正確
$fact = [1];
for ($i = 1; $i <= $m; $i++) {
    $fact[$i] = $fact[$i - 1] * $i % P;
}
$inv = array_fill(0, $m + 1, 1);
$inv[$m] = power($fact[$m], P - 2);
for ($i = $m; $i >= 1; $i--) {
    $inv[$i - 1] = $inv[$i] * $i % P;
}
$out = [];
for ($i = 0; $i < $q; $i++) {
    $n = (int)$tok[1 + 2 * $i];
    $r = (int)$tok[2 + 2 * $i];
    $out[] = $r > $n ? 0 : $fact[$n] * $inv[$r] % P * $inv[$n - $r] % P;
}
echo implode("\n", $out), "\n";
