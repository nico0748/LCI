<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$n = (int)$tok[0];
$m = (int)$tok[1];
$free = array_fill(0, $m, 0);  // 窓口 k が空く時刻（PHP の int は 64bit）
$out = [];
for ($i = 0; $i < $n; $i++) {
    $a = (int)$tok[2 + 2 * $i];
    $d = (int)$tok[3 + 2 * $i];
    $s = max($a, min($free));  // 案内時刻 = max(到着, 最も早く空く時刻)
    $k = 0;
    while ($free[$k] > $s) $k++;  // 時刻 s に空いている窓口のうち番号最小
    $free[$k] = $s + $d;
    $out[] = ($k + 1) . ' ' . ($s - $a);
}
echo implode("\n", $out), "\n";
