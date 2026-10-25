<?php
$t = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$k = 0;
$n = (int)$t[$k++];
$m = (int)$t[$k++];
$points = [];
for ($j = 0; $j < $m; $j++) $points[] = (int)$t[$k++];

$score = [];
$seen = []; // "名前 地点" を 1 回だけ数える
for ($i = 0; $i < $n; $i++) {
    $name = $t[$k++];
    $c = (int)$t[$k++];
    if (isset($seen["$name $c"])) continue;
    $seen["$name $c"] = true;
    $score[$name] = ($score[$name] ?? 0) + $points[$c - 1];
}

// 得点の降順、同点は名前の昇順（名前は英小文字だけなので、連想配列のキーが整数に変わることはない）
$rows = [];
foreach ($score as $name => $s) $rows[] = [(string)$name, $s];
usort($rows, fn($a, $b) => $b[1] <=> $a[1] ?: strcmp($a[0], $b[0]));
$out = [];
foreach (array_slice($rows, 0, 3) as [$name, $s]) $out[] = "$name $s";
echo implode("\n", $out), "\n";
