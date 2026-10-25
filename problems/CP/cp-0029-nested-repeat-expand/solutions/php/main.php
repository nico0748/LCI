<?php
$s = trim(stream_get_contents(STDIN));
$n = strlen($s);
// $stack の末尾は今いる括弧の中で、ここまでに展開した文字列
$stack = [''];
$counts = []; // 開いている括弧ごとの回数
$i = 0;
while ($i < $n) {
    $ch = $s[$i];
    if (ctype_digit($ch)) {
        $j = $i;
        while (ctype_digit($s[$j])) $j++; // 回数は複数桁（例: 999a、12(…)）
        $k = (int)substr($s, $i, $j - $i);
        if ($s[$j] === '(') {
            $counts[] = $k;
            $stack[] = '';
        } else {
            $stack[count($stack) - 1] .= str_repeat($s[$j], $k); // 直後の 1 文字だけを k 個
        }
        $i = $j + 1;
    } elseif ($ch === ')') {
        $body = array_pop($stack);
        $stack[count($stack) - 1] .= str_repeat($body, array_pop($counts));
        $i++;
    } else {
        $stack[count($stack) - 1] .= $ch;
        $i++;
    }
}
echo $stack[0], "\n";
