<?php
// 絵柄の行は空白を含まないので、空白区切りのトークンとして読める
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$p = 0;
$H = (int)$tok[$p++];
$W = (int)$tok[$p++];
$N = (int)$tok[$p++];
$canvas = array_fill(0, $H, str_repeat('.', $W));
for ($k = 0; $k < $N; $k++) {
    $h = (int)$tok[$p++];
    $w = (int)$tok[$p++];
    $r = (int)$tok[$p++];
    $c = (int)$tok[$p++];
    for ($i = 0; $i < $h; $i++) {
        $y = $r - 1 + $i;
        if ($y < 0 || $y >= $H) continue;
        $row = $tok[$p + $i];
        $line = $canvas[$y];
        for ($j = 0; $j < $w; $j++) {
            $x = $c - 1 + $j;
            // 文字列の範囲外に代入すると空白で伸びるので、範囲を確かめてから書く
            if ($row[$j] !== '.' && $x >= 0 && $x < $W) $line[$x] = $row[$j];
        }
        $canvas[$y] = $line;
    }
    $p += $h;
}
echo implode("\n", $canvas), "\n";
