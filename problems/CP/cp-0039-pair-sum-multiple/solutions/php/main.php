<?php
$tok = explode(' ', preg_replace('/\s+/', ' ', trim(stream_get_contents(STDIN))));
$n = (int)$tok[0];
$m = (int)$tok[1];
$cnt = [];  // 余り → 個数（M は最大 10^9 なので連想配列で持つ）
$ans = 0;   // PHP の int は 64bit
for ($i = 0; $i < $n; $i++) {
    $r = (int)$tok[2 + $i] % $m;
    $ans += $cnt[($m - $r) % $m] ?? 0;  // それまでに見た「組める余り」の袋の数
    $cnt[$r] = ($cnt[$r] ?? 0) + 1;
}
echo $ans, "\n";
