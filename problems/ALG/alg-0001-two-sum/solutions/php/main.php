<?php
$data = preg_split('/\s+/', trim(stream_get_contents(STDIN)));
$n = (int)$data[0];
$k = (int)$data[1];
$seen = [];
for ($j = 0; $j < $n; $j++) {
    $x = (int)$data[2 + $j];
    $need = $k - $x;
    if (isset($seen[$need])) {
        echo ($seen[$need] + 1) . ' ' . ($j + 1) . "\n";
        exit(0);
    }
    if (!isset($seen[$x])) {
        $seen[$x] = $j;
    }
}
echo "-1\n";
