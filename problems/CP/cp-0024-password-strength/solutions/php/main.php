<?php
const SYMBOLS = '!#$%&*+-=?@_';

function judge(string $user, string $pw): string
{
    $len = strlen($pw);
    // 規則 1: 長さ
    if ($len < 8 || $len > 64) return '1';
    $upper = $lower = $digit = $symbol = 0;
    for ($i = 0; $i < $len; $i++) {
        $c = $pw[$i];
        if ($c >= 'A' && $c <= 'Z') $upper = 1;
        elseif ($c >= 'a' && $c <= 'z') $lower = 1;
        elseif ($c >= '0' && $c <= '9') $digit = 1;
        elseif (strpos(SYMBOLS, $c) !== false) $symbol = 1;
        else return '2'; // 規則 2: 使えない文字
    }
    // 規則 3: 4 種類のうち 3 種類以上
    if ($upper + $lower + $digit + $symbol < 3) return '3';
    // 規則 4: 同じ文字の 3 連続（数えた直後に判定するので末尾の連続も漏れない）
    $run = 1;
    for ($i = 1; $i < $len; $i++) {
        $run = $pw[$i] === $pw[$i - 1] ? $run + 1 : 1;
        if ($run >= 3) return '4';
    }
    // 規則 5: ユーザー名を含まない（stripos は大文字小文字を区別しない。0 番目で見つかると 0 なので !== false）
    if (stripos($pw, $user) !== false) return '5';
    return 'OK';
}

$lines = explode("\n", stream_get_contents(STDIN));
$n = (int)$lines[0];
$out = [];
for ($i = 1; $i <= $n; $i++) {
    [$user, $pw] = explode(' ', rtrim($lines[$i], "\r"), 2);
    $out[] = judge($user, $pw);
}
echo implode("\n", $out), "\n";
