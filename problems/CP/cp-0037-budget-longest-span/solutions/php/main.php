<?php
$tok = explode(' ', preg_replace('/\s+/', ' ', trim(stream_get_contents(STDIN))));
$n = (int)$tok[0];
$b = (int)$tok[1];  // PHP の int は 64bit なので 10^15 も正確
$bestLen = 0;
$bestL = 0;
$s = 0;
$l = 0;
for ($r = 0; $r < $n; $r++) {
    $s += (int)$tok[2 + $r];
    while ($s > $b) {  // 費用は 0 以上なので、左端を進めれば合計は減る
        $s -= (int)$tok[2 + $l];
        $l++;
    }
    if ($r - $l + 1 > $bestLen) {  // 同じ長さなら早い開始日を残す
        $bestLen = $r - $l + 1;
        $bestL = $l + 1;
    }
}
echo $bestLen ? "$bestLen $bestL\n" : "0\n";
