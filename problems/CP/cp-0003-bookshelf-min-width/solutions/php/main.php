<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$n = (int)$tok[0];
$k = (int)$tok[1];
$w = array_map('intval', array_slice($tok, 2, $n));
// 答えは [max(w), Σw] の中。PHP の整数は 64bit なので Σw ≤ 2×10^14 もそのまま持てる
$lo = max($w);
$hi = array_sum($w);

// 棚幅 $cap で、左から詰めて K 段以内に収まるか（$cap ≥ max(w) で呼ぶ）
function fits(array $w, int $k, int $cap): bool
{
    $count = 1;
    $cur = 0;
    foreach ($w as $x) {
        $cur += $x;
        if ($cur > $cap) {
            if (++$count > $k) {
                return false;
            }
            $cur = $x;
        }
    }
    return true;
}

while ($lo < $hi) {
    $mid = intdiv($lo + $hi, 2);
    if (fits($w, $k, $mid)) {
        $hi = $mid;
    } else {
        $lo = $mid + 1;
    }
}
echo $lo, "\n";
