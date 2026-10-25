<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$g = (int)$tok[0];
$rank = [];
for ($i = 0; $i < $g; $i++) $rank[$tok[1 + $i]] = $i;
$n = (int)$tok[1 + $g];
$books = [];
for ($i = 0, $p = 2 + $g; $i < $n; $i++, $p += 3) {
    $genre = $tok[$p + 1];
    // [書名, ジャンル, 年, 順位]。一覧に無いジャンルは順位 G。年は int（文字列のままだと "794" > "1200"）
    $books[] = [$tok[$p], $genre, (int)$tok[$p + 2], $rank[$genre] ?? $g];
}
// 書名・ジャンル名は strcmp で比べる（<=> や sort() は "10" と "9"、"1e3" と "999" を数値として比べてしまう）
usort($books, function ($a, $b) use ($g) {
    if ($a[3] !== $b[3]) return $a[3] <=> $b[3];
    if ($a[3] === $g && $a[1] !== $b[1]) return strcmp($a[1], $b[1]);
    if ($a[2] !== $b[2]) return $b[2] <=> $a[2]; // 新しい順
    return strcmp($a[0], $b[0]);
});
echo implode("\n", array_column($books, 0)), "\n";
