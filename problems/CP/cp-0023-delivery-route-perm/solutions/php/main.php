<?php
$t = array_map('intval', preg_split('/\s+/', trim(stream_get_contents(STDIN))));
$k = 0;
$n = $t[$k++];
$m = $t[$k++];
$xs = [];
$ys = [];
for ($i = 0; $i <= $n; $i++) {
    $xs[] = $t[$k++];
    $ys[] = $t[$k++];
}
$need = array_fill(0, $n + 1, 0); // need[b]: b より先に訪れる地点の集合（ビット）
for ($j = 0; $j < $m; $j++) {
    $a = $t[$k++];
    $b = $t[$k++];
    $need[$b] |= 1 << $a;
}
$d = [];
for ($i = 0; $i <= $n; $i++)
    for ($j = 0; $j <= $n; $j++)
        $d[$i][$j] = sqrt(($xs[$i] - $xs[$j]) ** 2 + ($ys[$i] - $ys[$j]) ** 2);

$best = INF;
// 使用済みの集合 mask（ビット 0 は営業所）を持ち、条件を満たす地点だけを次に置く再帰で順列を列挙する
function dfs(int $last, int $mask, int $placed, float $acc): void
{
    global $n, $need, $d, $best;
    if ($placed === $n) {
        $total = $acc + $d[$last][0];
        if ($total < $best) $best = $total;
        return;
    }
    for ($v = 1; $v <= $n; $v++) {
        if (($mask >> $v) & 1) continue;
        if ($need[$v] & ~$mask) continue;
        dfs($v, $mask | (1 << $v), $placed + 1, $acc + $d[$last][$v]);
    }
}
dfs(0, 1, 0, 0.0);
printf("%.10f\n", $best);
