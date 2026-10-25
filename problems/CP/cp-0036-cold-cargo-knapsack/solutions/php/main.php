<?php
$tok = array_map('intval', preg_split('/\s+/', trim(stream_get_contents(STDIN))));
[$n, $W, $C] = [$tok[0], $tok[1], $tok[2]];
// dp[k][w] = 冷蔵品 k 個以下・重さ w 以下での報酬の最大（PHP の int は 64bit）
$dp = array_fill(0, $C + 1, array_fill(0, $W + 1, 0));
for ($i = 0; $i < $n; $i++) {
    $w = $tok[3 + 3 * $i];
    $v = $tok[4 + 3 * $i];
    $f = $tok[5 + 3 * $i];
    if ($w > $W) continue;
    // k も重さも大きい方から: 右辺はこの荷物を使う前の値（同じ荷物を 2 回使わない）
    for ($k = $C; $k >= $f; $k--) {
        $row = $dp[$k];
        if ($f) {
            $src = $dp[$k - 1];  // k の降順なので、1 段下の行はまだこの荷物を使う前
            for ($x = $W; $x >= $w; $x--) {
                $cand = $src[$x - $w] + $v;
                if ($cand > $row[$x]) $row[$x] = $cand;
            }
        } else {
            for ($x = $W; $x >= $w; $x--) {  // 同じ行を重さの降順に: x − w はまだ更新前
                $cand = $row[$x - $w] + $v;
                if ($cand > $row[$x]) $row[$x] = $cand;
            }
        }
        $dp[$k] = $row;
    }
}
echo $dp[$C][$W], "\n";
