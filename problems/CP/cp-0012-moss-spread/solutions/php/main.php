<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
[$h, $w, $t] = [(int)$tok[0], (int)$tok[1], (int)$tok[2]];
$g = array_slice($tok, 3, $h); // 各行は文字列のまま（$g[$r][$c] で 1 文字を読み書きできる）
for ($day = 0; $day < $t; $day++) {
    $nxt = $g; // PHP の配列・文字列は代入でコピーされる（二重バッファ: 判定は $g、書き込みは $nxt）
    for ($r = 0; $r < $h; $r++) {
        for ($c = 0; $c < $w; $c++) {
            $ch = $g[$r][$c];
            if ($ch === '#') continue;
            $m = 0; // 上下左右の苔の数（盤の外は数えない）
            if ($r > 0 && $g[$r - 1][$c] === 'o') $m++;
            if ($r + 1 < $h && $g[$r + 1][$c] === 'o') $m++;
            if ($c > 0 && $g[$r][$c - 1] === 'o') $m++;
            if ($c + 1 < $w && $g[$r][$c + 1] === 'o') $m++;
            if ($ch === '.') {
                if ($m >= 2) $nxt[$r][$c] = 'o';
            } elseif ($m === 0 || $m === 4) {
                $nxt[$r][$c] = '.';
            }
        }
    }
    $g = $nxt;
}
echo implode("\n", $g), "\n";
