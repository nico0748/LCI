<?php
$t = explode(' ', preg_replace('/\s+/', ' ', trim(stream_get_contents(STDIN))));
$n = (int)$t[0];
$d = (int)$t[1];
// dp[i] = 店 1..i だけを使ったときの割引の最大（PHP の整数は 64bit なので 2×10^14 もそのまま）
$dp = array_fill(0, $n + 1, 0);
for ($i = 1; $i <= $n; $i++) {
    $j = $i - $d; // 店 i で買うなら、直前に買えるのは店 i−D 以前
    $take = (int)$t[$i + 1] + ($j >= 0 ? $dp[$j] : 0);
    $dp[$i] = $take > $dp[$i - 1] ? $take : $dp[$i - 1];
}
echo $dp[$n], "\n";
