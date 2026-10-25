<?php
const MOD = 1000000007;
$tok = explode(' ', preg_replace('/\s+/', ' ', trim(stream_get_contents(STDIN))));
$n = (int)$tok[0];
$k = (int)$tok[1];  // PHP の int は 64bit なので 10^18 も正確
$t = [0];
$a = [0];
for ($i = 1; $i <= $n; $i++) $t[$i] = (int)$tok[1 + $i];
for ($i = 1; $i <= $n; $i++) $a[$i] = (int)$tok[1 + $n + $i];
$first = array_fill(0, $n + 1, -1);
$order = [];
$pre = [0];  // 最大 2×10^14
$x = 1;
while ($first[$x] < 0) {
    $first[$x] = count($order);
    $order[] = $x;
    $pre[] = $pre[count($pre) - 1] + $a[$x];
    $x = $t[$x];
}
$mu = $first[$x];               // 尾の長さ
$lam = count($order) - $mu;     // 周期の長さ
if ($k <= count($order)) {
    echo $t[$order[$k - 1]], ' ', $pre[$k] % MOD, "\n";
    exit(0);
}
$q = intdiv($k - $mu, $lam);
$r = ($k - $mu) % $lam;
$cyc = ($pre[$mu + $lam] - $pre[$mu]) % MOD;
$total = ($pre[$mu + $r] % MOD + ($q % MOD) * $cyc) % MOD;  // mod してから掛ける（積は約 10^18 で PHP_INT_MAX 未満）
echo $order[$mu + $r], ' ', $total, "\n";
