<?php
// 本文には空白が続くことがあるので、空白で区切らず行で読む
$lines = explode("\n", stream_get_contents(STDIN));
$n = (int)trim($lines[0]);
$words = [];
for ($i = 0; $i < $n; $i++) {
    $words[] = trim($lines[1 + $i]);
}
$s = rtrim($lines[1 + $n], "\r");
$len = strlen($s);
// 原文の上で一致を探して印だけ付ける（str_replace は重なった一致を拾わず、置換後の文字列で次の語を探してしまう）
$mark = array_fill(0, $len, false);
foreach ($words as $wd) {
    $m = strlen($wd);
    for ($i = 0; $i + $m <= $len; $i++) {
        if (substr_compare($s, $wd, $i, $m) === 0) {
            for ($j = $i; $j < $i + $m; $j++) {
                $mark[$j] = true;
            }
        }
    }
}
$out = $s;
for ($i = 0; $i < $len; $i++) {
    if ($mark[$i]) {
        $out[$i] = '*';
    }
}
echo $out, "\n";
