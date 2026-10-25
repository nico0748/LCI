<?php
$t = explode(' ', preg_replace('/\s+/', ' ', trim(stream_get_contents(STDIN))));
$n = (int)$t[0];
// 時刻をキーにして増減をまとめる（同じ時刻の終了 −c と開始 +c は先に相殺される = 終了を先に処理するのと同じ）
$delta = [];
for ($i = 1; $i <= 3 * $n; $i += 3) {
    $s = (int)$t[$i];
    $e = (int)$t[$i + 1];
    $c = (int)$t[$i + 2];
    $delta[$s] = ($delta[$s] ?? 0) + $c;
    $delta[$e] = ($delta[$e] ?? 0) - $c;
}
ksort($delta); // 変化する時刻だけを昇順に見る（座標圧縮）
$cur = 0; // PHP の整数は 64bit なので 10^14 もそのまま
$best = -1;
$at = -1;
foreach ($delta as $x => $dx) {
    $cur += $dx;
    if ($cur > $best) {
        $best = $cur;
        $at = $x;
    }
}
echo $best, ' ', $at, "\n";
