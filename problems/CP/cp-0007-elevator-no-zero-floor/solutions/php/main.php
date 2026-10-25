<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$n = (int)$tok[0];

// 0 階が無いので、地下は 1 つずらして詰める: B1→0, B2→-1, B3→-2（地上はそのまま）
function level(string $s): int
{
    return $s[0] === 'B' ? 1 - (int)substr($s, 1) : (int)$s;
}

$total = 0;
for ($i = 2; $i <= $n; $i++) {
    $total += abs(level($tok[$i]) - level($tok[$i - 1]));
}
echo $total, "\n";
