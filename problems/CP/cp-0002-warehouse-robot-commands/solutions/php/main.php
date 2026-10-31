<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$h = (int)$tok[0];
$w = (int)$tok[1];
$grid = array_slice($tok, 2, $h);
$cmds = $tok[3 + $h];
$r = $c = 0;
foreach ($grid as $i => $row) {
    $j = strpos($row, 'S');
    if ($j !== false) {
        $r = $i;
        $c = $j;
    }
}
// 向き 0=北 1=東 2=南 3=西。L は ($d + 3) % 4（PHP の % は負の数に負を返すので $d - 1 は使わない）
$dr = [-1, 0, 1, 0];
$dc = [0, 1, 0, -1];
$seen = array_fill(0, $h * $w, false);
$seen[$r * $w + $c] = true; // 出発マスも数える
$count = 1;
$d = 0;
$len = strlen($cmds);
for ($k = 0; $k < $len; $k++) {
    $ch = $cmds[$k];
    if ($ch === 'F') {
        $nr = $r + $dr[$d];
        $nc = $c + $dc[$d];
        if ($nr >= 0 && $nr < $h && $nc >= 0 && $nc < $w && $grid[$nr][$nc] !== '#') {
            $r = $nr;
            $c = $nc;
            if (!$seen[$r * $w + $c]) {
                $seen[$r * $w + $c] = true;
                $count++;
            }
        }
    } elseif ($ch === 'R') {
        $d = ($d + 1) % 4;
    } else {
        $d = ($d + 3) % 4;
    }
}
echo ($r + 1), ' ', ($c + 1), "\n", $count, "\n";
