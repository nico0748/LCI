<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$n = (int)$tok[0];
$q = (int)$tok[1];
$parent = range(0, $n);
$size = array_fill(0, $n + 1, 1);

// 根を返す。$parent は参照で受け取る（値渡しだと書き換えのたびに配列がコピーされる）。経路半減で木を浅く保つ
function find(array &$parent, int $x): int
{
    while ($parent[$x] !== $x) {
        $parent[$x] = $parent[$parent[$x]];
        $x = $parent[$x];
    }
    return $x;
}

$out = [];
$p = 2;
for ($j = 0; $j < $q; $j++) {
    $t = $tok[$p];
    if ($t === '2') {
        $out[] = $size[find($parent, (int)$tok[$p + 1])];
        $p += 2;
        continue;
    }
    $a = find($parent, (int)$tok[$p + 1]);
    $b = find($parent, (int)$tok[$p + 2]);
    $p += 3;
    if ($t === '1') {
        if ($a !== $b) { // 既に同じ組なら何もしない。小さい組を大きい組の下に付ける
            if ($size[$a] < $size[$b]) {
                [$a, $b] = [$b, $a];
            }
            $parent[$b] = $a;
            $size[$a] += $size[$b];
        }
    } else {
        $out[] = $a === $b ? 'Yes' : 'No';
    }
}
echo implode("\n", $out), "\n";
