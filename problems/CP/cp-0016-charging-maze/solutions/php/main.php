<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
[$h, $w, $b] = [(int)$tok[0], (int)$tok[1], (int)$tok[2]];
$g = implode('', array_slice($tok, 3, $h)); // マス v = r*w + c
$start = strpos($g, 'S');
$goal = strpos($g, 'G');
$k = $b + 1;
// 状態 = (マス, 残り) を v*k + e の 1 つの整数に。マスだけで訪問済みにすると充電の遠回りを捨てる
$dist = array_fill(0, $h * $w * $k, -1);
$queue = [$start * $k + $b];
$dist[$start * $k + $b] = 0;
for ($head = 0; $head < count($queue); $head++) { // 配列＋先頭インデックス（array_shift は O(n)）
    $s = $queue[$head];
    $e = $s % $k;
    if ($e === 0) continue; // 電池切れ: 動けない
    $v = intdiv($s, $k);
    $d = $dist[$s] + 1;
    $r = intdiv($v, $w);
    $c = $v % $w;
    $nbs = [$r > 0 ? $v - $w : -1, $r + 1 < $h ? $v + $w : -1, $c > 0 ? $v - 1 : -1, $c + 1 < $w ? $v + 1 : -1];
    foreach ($nbs as $u) {
        if ($u < 0 || $g[$u] === '#') continue;
        if ($u === $goal) { // 残り 0 で着いてもよい。BFS なので最初に着いた手数が最短
            echo $d, "\n";
            exit(0);
        }
        $t = $u * $k + ($g[$u] === 'C' ? $b : $e - 1);
        if ($dist[$t] === -1) {
            $dist[$t] = $d;
            $queue[] = $t;
        }
    }
}
echo "-1\n";
