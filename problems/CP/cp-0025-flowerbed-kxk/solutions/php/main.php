<?php
$t = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
[$h, $w, $k] = [(int)$t[0], (int)$t[1], (int)$t[2]];
// S[i*(W+1)+j] = 上 i 行・左 j 列の花の合計（0 の行と列を足した (H+1)×(W+1) を 1 次元で持つ）
$w1 = $w + 1;
$S = array_fill(0, ($h + 1) * $w1, 0);
for ($i = 0; $i < $h; $i++) {
    $g = unpack('C*', $t[3 + $i]); // 1 始まりの文字コードの配列（'0' = 48）
    $prev = $i * $w1;
    $base = $prev + $w1;
    $acc = 0;
    for ($j = 1; $j <= $w; $j++) {
        $acc += $g[$j] - 48;
        $S[$base + $j] = $S[$prev + $j] + $acc;
    }
}
$best = -1;
$br = $bc = 0;
for ($r = 0; $r + $k <= $h; $r++) {
    $top = $r * $w1;
    $bot = ($r + $k) * $w1;
    for ($c = 0; $c + $k <= $w; $c++) {
        $v = $S[$bot + $c + $k] - $S[$top + $c + $k] - $S[$bot + $c] + $S[$top + $c];
        if ($v > $best) { // 行優先で「より大きいときだけ」更新 → 同点は上・左が残る
            $best = $v;
            $br = $r;
            $bc = $c;
        }
    }
}
echo $best, "\n", $br + 1, ' ', $bc + 1, "\n";
