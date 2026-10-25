<?php
$tok = array_map('intval', preg_split('/\s+/', trim(stream_get_contents(STDIN))));
$n = $tok[0];
$c = $tok[1];
$s = [];
$e = [];
for ($i = 0; $i < $n; $i++) {
    $s[] = $tok[2 + 2 * $i];
    $e[] = $tok[3 + 2 * $i];
}
array_multisort($e, $s); // 終了時刻の早い順（s も同じ順に並び替わる）
$freeAt = 0; // 次の予約が始まってよい最も早い時刻 = 直前の終了 + C（PHP の int は 64bit）
$cnt = 0;
for ($i = 0; $i < $n; $i++) {
    if ($s[$i] >= $freeAt) { // ちょうど「終了 + C」に始まる予約は受けられる
        $cnt++;
        $freeAt = $e[$i] + $c;
    }
}
echo $cnt, "\n";
