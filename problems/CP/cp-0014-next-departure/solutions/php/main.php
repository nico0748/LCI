<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$toMin = fn(string $s): int => (int)substr($s, 0, 2) * 60 + (int)substr($s, 3, 2);
$n = (int)$tok[0];
$deps = array_map($toMin, array_slice($tok, 1, $n));
sort($deps); // 時刻表は時刻順とは限らない（整数なので sort でよい）
$q = (int)$tok[1 + $n];
$out = [];
foreach (array_slice($tok, 2 + $n, $q) as $s) {
    $u = $toMin($s);
    $dep = null;
    foreach ($deps as $d) {
        if ($d >= $u) { // ちょうどの時刻の便にも乗れる
            $dep = $d;
            break;
        }
    }
    if ($dep === null) { // 今日の便はもう無い → 翌日の始発
        $dep = $deps[0];
        $wait = $dep + 1440 - $u;
    } else {
        $wait = $dep - $u;
    }
    $out[] = sprintf('%02d:%02d %d', intdiv($dep, 60), $dep % 60, $wait);
}
echo implode("\n", $out), "\n";
