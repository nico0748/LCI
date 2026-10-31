<?php
// 素朴解（TLE させたい解）: ヒープは使うが、取り出した要素が古い（記録された距離より大きい）ときも捨てずに辺を見直す Dijkstra。
// hidden-max-stale-hub では拠点 N が 5×10^4 回 push され、古い要素を取り出すたびに 5×10^4 本の辺を見るので 2.5×10^9 回になり TLE
$t = array_map('intval', preg_split('/\s+/', trim(stream_get_contents(STDIN))));
[$n, $m, $T] = [$t[0], $t[1], $t[2]];
$adj = array_fill(0, $n + 1, []);
for ($j = 0; $j < $m; $j++) {
    [$u, $v, $w] = [$t[3 + 3 * $j], $t[4 + 3 * $j], $t[5 + 3 * $j]];
    $adj[$u][] = [$v, $w];
    $adj[$v][] = [$u, $w];
}
$INF = PHP_INT_MAX;
$dist = array_fill(0, $n + 1, $INF);
$dist[1] = 0;
$pq = new SplMinHeap();
$pq->insert([0, 1]);
while (!$pq->isEmpty()) {
    [$d, $u] = $pq->extract();
    // 本来はここで if ($d > $dist[$u]) continue; が必要
    foreach ($adj[$u] as [$v, $w]) {
        if ($dist[$u] + $w < $dist[$v]) {
            $dist[$v] = $dist[$u] + $w;
            $pq->insert([$dist[$v], $v]);
        }
    }
}
$within = 0;
for ($i = 1; $i <= $n; $i++) if ($dist[$i] <= $T) $within++;
echo $within, "\n", ($dist[$n] === $INF ? -1 : $dist[$n]), "\n";
