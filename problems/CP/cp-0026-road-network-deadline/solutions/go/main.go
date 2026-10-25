package main

import (
	"bufio"
	"fmt"
	"io"
	"math"
	"os"
)

func main() {
	data, _ := io.ReadAll(bufio.NewReader(os.Stdin))
	pos := 0
	nextInt := func() int64 {
		for data[pos] < '0' || data[pos] > '9' {
			pos++
		}
		var x int64
		for pos < len(data) && data[pos] >= '0' && data[pos] <= '9' {
			x = x*10 + int64(data[pos]-'0')
			pos++
		}
		return x
	}
	n, m, T := int(nextInt()), int(nextInt()), nextInt()
	eu, ev, ew := make([]int32, m), make([]int32, m), make([]int64, m)
	start := make([]int32, n+2)
	for j := 0; j < m; j++ {
		eu[j], ev[j], ew[j] = int32(nextInt()), int32(nextInt()), nextInt()
		start[eu[j]+1]++
		start[ev[j]+1]++
	}
	// 隣接リストを CSR（拠点 v の辺は to[start[v]:start[v+1]]）で持つ
	for v := 1; v <= n+1; v++ {
		start[v] += start[v-1]
	}
	fill := append([]int32(nil), start...)
	to, wt := make([]int32, 2*m), make([]int64, 2*m)
	for j := 0; j < m; j++ {
		u, v := eu[j], ev[j]
		to[fill[u]], wt[fill[u]] = v, ew[j]
		fill[u]++
		to[fill[v]], wt[fill[v]] = u, ew[j]
		fill[v]++
	}

	// 二分ヒープ（距離 int64, 拠点）。container/heap でもよいが、自作の方が速い
	type item struct {
		d int64
		v int32
	}
	heap := make([]item, 0, 2*m+1)
	push := func(it item) {
		heap = append(heap, it)
		i := len(heap) - 1
		for i > 0 {
			p := (i - 1) / 2
			if heap[p].d <= it.d {
				break
			}
			heap[i] = heap[p]
			i = p
		}
		heap[i] = it
	}
	pop := func() item {
		top := heap[0]
		last := heap[len(heap)-1]
		heap = heap[:len(heap)-1]
		i, sz := 0, len(heap)
		for {
			c := 2*i + 1
			if c >= sz {
				break
			}
			if c+1 < sz && heap[c+1].d < heap[c].d {
				c++
			}
			if heap[c].d >= last.d {
				break
			}
			heap[i] = heap[c]
			i = c
		}
		if sz > 0 {
			heap[i] = last
		}
		return top
	}

	const inf = int64(math.MaxInt64)
	dist := make([]int64, n+1)
	for i := range dist {
		dist[i] = inf
	}
	dist[1] = 0
	push(item{0, 1})
	for len(heap) > 0 {
		it := pop()
		u := it.v
		if it.d > dist[u] {
			continue // 古い要素は捨てる
		}
		for e := start[u]; e < start[u+1]; e++ {
			if nd := it.d + wt[e]; nd < dist[to[e]] {
				dist[to[e]] = nd
				push(item{nd, to[e]})
			}
		}
	}
	within := 0
	for v := 1; v <= n; v++ {
		if dist[v] <= T {
			within++
		}
	}
	ans := dist[n]
	if ans == inf {
		ans = -1
	}
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	fmt.Fprintf(w, "%d\n%d\n", within, ans)
}
