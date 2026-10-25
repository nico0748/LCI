package main

import (
	"bufio"
	"os"
	"strconv"
)

func main() {
	rd := bufio.NewReaderSize(os.Stdin, 1<<20)
	nextInt := func() int {
		x, c := 0, byte(0)
		for c, _ = rd.ReadByte(); c == ' ' || c == '\n' || c == '\r'; c, _ = rd.ReadByte() {
		}
		for ; c >= '0' && c <= '9'; c, _ = rd.ReadByte() {
			x = x*10 + int(c-'0')
		}
		return x
	}
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()

	n, m := nextInt(), nextInt()
	us, vs := make([]int32, m), make([]int32, m)
	indeg := make([]int32, n+1)
	start := make([]int32, n+2) // CSR: u の出辺は adj[start[u]:start[u+1]]
	for i := 0; i < m; i++ {
		u, v := nextInt(), nextInt()
		us[i], vs[i] = int32(u), int32(v)
		start[u+1]++
		indeg[v]++ // 重複した辺もそのまま数える
	}
	for u := 1; u <= n+1; u++ {
		start[u] += start[u-1]
	}
	fill := append([]int32(nil), start...)
	adj := make([]int32, m)
	for i := 0; i < m; i++ {
		adj[fill[us[i]]] = vs[i]
		fill[us[i]]++
	}
	// 段ごとの Kahn 法
	queue := make([]int32, 0, n)
	for v := 1; v <= n; v++ {
		if indeg[v] == 0 {
			queue = append(queue, int32(v))
		}
	}
	counts := []int{}
	for lo := 0; lo < len(queue); {
		hi := len(queue)
		counts = append(counts, hi-lo)
		for ; lo < hi; lo++ {
			u := queue[lo]
			for _, v := range adj[start[u]:start[u+1]] {
				indeg[v]--
				if indeg[v] == 0 {
					queue = append(queue, v)
				}
			}
		}
	}
	if len(queue) < n {
		out.WriteString("-1\n")
		return
	}
	out.WriteString(strconv.Itoa(len(counts)))
	out.WriteByte('\n')
	for i, c := range counts {
		if i > 0 {
			out.WriteByte(' ')
		}
		out.WriteString(strconv.Itoa(c))
	}
	out.WriteByte('\n')
}
