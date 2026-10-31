<?php
$tok = array_map('intval', preg_split('/\s+/', trim(stream_get_contents(STDIN))));
$p = 0;
$n = $tok[$p++];
$k = $tok[$p++];
$dice = array_slice($tok, $p, $k);
$p += $k;
$m = $tok[$p++];
$warp = [];  // 入口 → 出口
for ($j = 0; $j < $m; $j++) {
    $s = $tok[$p++];
    $warp[$s] = $tok[$p++];
}
$pos = 0;
foreach ($dice as $t => $d) {
    $pos += $d;
    if ($pos > $n) $pos = $n - ($pos - $n);  // 越えた分だけ戻る
    if ($pos === $n) {                        // ちょうど止まったときだけゴール。残りの出目は使わない
        echo "GOAL ", $t + 1, "\n";
        exit(0);
    }
    if (isset($warp[$pos])) $pos = $warp[$pos];  // 1 回だけ（出口のワープは使わない）
}
echo $pos, "\n";
