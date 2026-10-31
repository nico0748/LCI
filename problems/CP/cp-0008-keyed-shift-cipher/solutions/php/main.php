<?php
// 暗号文には空白が続くことがあるので、行で読む（行末の \r だけ落とす）
$lines = explode("\n", stream_get_contents(STDIN));
$key = trim($lines[0]);
$s = rtrim($lines[1], "\r");
$m = strlen($key);
$shift = [];
for ($i = 0; $i < $m; $i++) {
    $shift[] = ord($key[$i]) - 97;
}
$len = strlen($s);
$out = $s; // 同じ長さの文字列をその場で書き換える（.= で 1 文字ずつ足すより速い）
$j = 0; // 鍵の位置。英字を 1 文字戻したときだけ進める
for ($i = 0; $i < $len; $i++) {
    $c = ord($s[$i]);
    if ($c >= 97 && $c <= 122) {
        // PHP の % は負の数に負を返すので、+26 してから取る
        $out[$i] = chr(($c - 97 - $shift[$j % $m] + 26) % 26 + 97);
        $j++;
    } elseif ($c >= 65 && $c <= 90) {
        $out[$i] = chr(($c - 65 - $shift[$j % $m] + 26) % 26 + 65);
        $j++;
    }
}
echo $out, "\n";
