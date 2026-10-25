<?php
$t = explode(' ', preg_replace('/\s+/', ' ', trim(stream_get_contents(STDIN))));
$n = (int)$t[0];
// いもす法: [s, t) にいるので diff[s] += 1, diff[t] -= 1。t = 86400 があるので 86401 要素
$diff = array_fill(0, 86401, 0);
for ($i = 1; $i <= 2 * $n; $i += 2) {
    $diff[(int)$t[$i]]++;
    $diff[(int)$t[$i + 1]]--;
}
$cur = 0;
$peak = -1;
$first = -1;
$seconds = 0;
for ($x = 0; $x < 86400; $x++) {
    $cur += $diff[$x];
    if ($cur > $peak) {
        $peak = $cur;
        $first = $x;
        $seconds = 1;
    } elseif ($cur === $peak) {
        $seconds++;
    }
}
echo $peak, "\n", $first, "\n", $seconds, "\n";
