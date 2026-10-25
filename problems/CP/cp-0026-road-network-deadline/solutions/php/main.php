<?php
$t = explode(' ', preg_replace('/\s+/', ' ', trim(stream_get_contents(STDIN))));
$n = (int)$t[0];
$m = (int)$t[1];
$T = (int)$t[2]; // PHP の整数は 64bit なので 10^12 もそのまま
// 隣接リストを CSR（拠点 v の辺は $to[$start[v]] .. $to[$start[v+1]-1]）で持つ
$deg = array_fill(0, $n + 2, 0);
for ($j = 0; $j < $m; $j++) {
    $deg[(int)$t[3 + 3 * $j]]++;
    $deg[(int)$t[4 + 3 * $j]]++;
}
$start = array_fill(0, $n + 2, 0);
for ($v = 1; $v <= $n; $v++) $start[$v + 1] = $start[$v] + $deg[$v];
$fill = $start;
$to = array_fill(0, 2 * $m, 0);
$wt = array_fill(0, 2 * $m, 0);
for ($j = 0; $j < $m; $j++) {
    $u = (int)$t[3 + 3 * $j];
    $v = (int)$t[4 + 3 * $j];
    $w = (int)$t[5 + 3 * $j];
    $to[$fill[$u]] = $v;
    $wt[$fill[$u]++] = $w;
    $to[$fill[$v]] = $u;
    $wt[$fill[$v]++] = $w;
}
$INF = PHP_INT_MAX;
$dist = array_fill(0, $n + 1, $INF);
$dist[1] = 0;
// SplMinHeap に [距離, 拠点] を入れる（配列は先頭の要素から順に比べられる）
$pq = new SplMinHeap();
$pq->insert([0, 1]);
while (!$pq->isEmpty()) {
    [$d, $u] = $pq->extract();
    if ($d > $dist[$u]) continue; // 古い要素は捨てる
    for ($e = $start[$u], $end = $start[$u + 1]; $e < $end; $e++) {
        $v = $to[$e];
        $nd = $d + $wt[$e];
        if ($nd < $dist[$v]) {
            $dist[$v] = $nd;
            $pq->insert([$nd, $v]);
        }
    }
}
$within = 0;
for ($v = 1; $v <= $n; $v++) if ($dist[$v] <= $T) $within++;
echo $within, "\n", ($dist[$n] === $INF ? -1 : $dist[$n]), "\n";
