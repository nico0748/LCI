<?php
// 標準入力をまとめて読む（fgets を何度も呼ぶより速い）
$input = stream_get_contents(STDIN);
// 例: $tokens = preg_split('/\s+/', trim($input));  /  $lines = explode("\n", $input);
// TODO: 入力を解析して答えを求める
// 出力は配列に溜めて最後に 1 回で echo する（例: echo implode("\n", $out), "\n";）
unset($input);
