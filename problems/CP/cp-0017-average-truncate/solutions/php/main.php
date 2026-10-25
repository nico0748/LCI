<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$n = (int)$tok[0];
$names = [];
$scores = [];
for ($i = 0; $i < $n; $i++) {
    $names[] = $tok[1 + 2 * $i];
    $scores[] = (int)$tok[2 + 2 * $i];
}
$total = array_sum($scores);
// 整数だけで: 平均×10 の切り捨て（round・number_format・sprintf('%.1f') は四捨五入になる）
$v = intdiv($total * 10, $n);
$out = [intdiv($v, 10) . '.' . ($v % 10)];
// 「平均以上」は正確な平均と比べる: score >= total/n ⇔ score*n >= total
for ($i = 0; $i < $n; $i++) if ($scores[$i] * $n >= $total) $out[] = $names[$i];
echo implode("\n", $out), "\n";
