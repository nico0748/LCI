<?php
function isLeap(int $y): bool
{
    return $y % 4 === 0 && ($y % 100 !== 0 || $y % 400 === 0);
}

function daysIn(int $y, int $m): int
{
    if ($m === 2) return isLeap($y) ? 29 : 28;
    return in_array($m, [4, 6, 9, 11], true) ? 30 : 31;
}

// DateTime::modify('+1 month') は 1/31 → 3/3 のように繰り上がるので使わず、月の通し番号で計算する
$t = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$q = (int)$t[0];
$out = [];
for ($i = 0; $i < $q; $i++) {
    $s = $t[1 + 2 * $i];
    $k = (int)$t[2 + 2 * $i];
    $y = (int)substr($s, 0, 4);
    $m = (int)substr($s, 5, 2);
    $d = (int)substr($s, 8, 2);
    $idx = $y * 12 + ($m - 1) + $k;
    $ty = intdiv($idx, 12);
    $tm = $idx % 12 + 1;
    $last = daysIn($ty, $tm);
    if ($d > $last) { // 同じ日が無い → その月の末日
        [$ey, $em, $ed] = [$ty, $tm, $last];
    } elseif ($d > 1) { // 同じ日の前日
        [$ey, $em, $ed] = [$ty, $tm, $d - 1];
    } else { // 1 日の前日は前の月の末日
        [$ey, $em] = $tm > 1 ? [$ty, $tm - 1] : [$ty - 1, 12];
        $ed = daysIn($ey, $em);
    }
    $out[] = sprintf('%04d/%02d/%02d', $ey, $em, $ed);
}
echo implode("\n", $out), "\n";
