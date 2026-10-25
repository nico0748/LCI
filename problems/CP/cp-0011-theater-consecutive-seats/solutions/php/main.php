<?php
$tok = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
[$h, $w, $k] = [(int)$tok[0], (int)$tok[1], (int)$tok[2]];
for ($r = 0; $r < $h; $r++) {
    $row = $tok[3 + $r];
    $run = 0; // この列で、いま続いている空席の数（列が変わったら 0 から数え直す）
    for ($c = 0; $c < $w; $c++) {
        if ($row[$c] === '.') {
            if (++$run === $k) {
                echo ($r + 1), ' ', ($c - $k + 2), "\n"; // 左端は c-k+1（0 始まり）→ 1 始まり
                exit(0);
            }
        } else {
            $run = 0;
        }
    }
}
echo "-1\n";
