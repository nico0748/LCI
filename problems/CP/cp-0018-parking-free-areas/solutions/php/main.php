<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
[$h, $w] = [(int)$tok[0], (int)$tok[1]];
$w2 = $w + 2;
// 周りを '#' で 1 周囲んだ 1 次元の文字列（範囲チェックが要らない）。上下左右は ±1, ±w2
$g = str_repeat('#', $w2);
for ($r = 0; $r < $h; $r++) $g .= '#' . $tok[2 + $r] . '#';
$g .= str_repeat('#', $w2);
$count = 0;
$best = 0;
$pos = strpos($g, '.');
while ($pos !== false) {
    $count++;
    $g[$pos] = '#'; // 訪問済みの印は積むときに付ける
    $stack = [$pos]; // 再帰ではなく明示的なスタック
    $area = 0;
    while ($stack) {
        $x = array_pop($stack);
        $area++;
        foreach ([$x - 1, $x + 1, $x - $w2, $x + $w2] as $y) {
            if ($g[$y] === '.') {
                $g[$y] = '#';
                $stack[] = $y;
            }
        }
    }
    if ($area > $best) $best = $area;
    $pos = strpos($g, '.', $pos); // 次の未訪問の空き区画へ一気に飛ぶ
}
echo "$count $best\n";
