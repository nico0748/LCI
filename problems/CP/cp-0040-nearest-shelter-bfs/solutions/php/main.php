<?php
$lines = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$h = (int)$lines[0];
$w = (int)$lines[1];
$w2 = $w + 2;  // 周りを壁で囲んだ 1 次元の盤面にして、範囲チェックを省く
// 盤面を 1 本の文字列にする: '.' はまだ訪れていない道、それ以外（'#'・'S'・訪問済み）は通れない扱い
$wall = str_repeat('#', $w2);
$g = $wall;
for ($i = 0; $i < $h; $i++) $g .= '#' . $lines[2 + $i] . '#';
$g .= $wall;
$dots = substr_count($g, '.');
$queue = [];  // 多始点 BFS のキュー（array_shift は遅いので添字で読む）
$off = 0;
while (($p = strpos($g, 'S', $off)) !== false) {
    $queue[] = $p;  // 避難所は距離 0 として最初からキューへ
    $off = $p + 1;
}
if (!$queue) {
    echo "-1 $dots\n";
    exit(0);
}
$shelters = count($queue);
// 段ごとに進める（距離の配列が要らず、段の数が最遠の距離になる）
$cur = $queue;
$far = 0;
$reached = 0;
while (true) {
    $next = [];
    foreach ($cur as $p) {
        foreach ([$p - 1, $p + 1, $p - $w2, $p + $w2] as $q) {
            if ($g[$q] === '.') {
                $g[$q] = 'v';
                $next[] = $q;
            }
        }
    }
    if (!$next) break;
    $far++;
    $reached += count($next);
    $cur = $next;
}
echo $far, ' ', $dots - $reached, "\n";
