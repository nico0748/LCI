<?php
$tok = explode(' ', preg_replace('/\s+/', ' ', trim(stream_get_contents(STDIN))));
$k = (int)$tok[0];
$n = 1 << $k;
$s = [0];
for ($i = 1; $i <= $n; $i++) $s[$i] = (int)$tok[$i];
$line = [];  // 今の回戦に残っている選手番号（表の左から）
for ($i = 0; $i < $n; $i++) $line[] = (int)$tok[1 + $n + $i];
$wins = array_fill(0, $n + 1, 0);
while (count($line) > 1) {
    $next = [];
    $cnt = count($line);
    for ($i = 0; $i < $cnt; $i += 2) {
        $a = $line[$i];
        $b = $line[$i + 1];
        // 強さが大きい方、同じなら番号が小さい方（表の左右ではない）
        $w = ($s[$a] > $s[$b] || ($s[$a] === $s[$b] && $a < $b)) ? $a : $b;
        $wins[$w]++;
        $next[] = $w;
    }
    $line = $next;
}
array_shift($wins);
echo $line[0], "\n", implode(' ', $wins), "\n";
