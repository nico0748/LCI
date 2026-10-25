package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

func main() {
	in := bufio.NewReader(os.Stdin)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	var h, w, b int
	fmt.Fscan(in, &h, &w, &b)
	var sb strings.Builder
	for r := 0; r < h; r++ {
		var s string
		fmt.Fscan(in, &s)
		sb.WriteString(s)
	}
	g := sb.String() // マス v = r*w + c
	start, goal := strings.IndexByte(g, 'S'), strings.IndexByte(g, 'G')
	k := b + 1
	// 状態 = (マス, 残り) を v*k + e の 1 つの整数に。マスだけで訪問済みにすると充電の遠回りを捨てる
	dist := make([]int32, h*w*k)
	for i := range dist {
		dist[i] = -1
	}
	queue := make([]int32, 0, h*w*k)
	dist[start*k+b] = 0
	queue = append(queue, int32(start*k+b))
	for head := 0; head < len(queue); head++ {
		s := int(queue[head])
		v, e := s/k, s%k
		if e == 0 { // 電池切れ: 動けない
			continue
		}
		d := dist[s] + 1
		r, c := v/w, v%w
		nbs := [4]int{-1, -1, -1, -1}
		if r > 0 {
			nbs[0] = v - w
		}
		if r+1 < h {
			nbs[1] = v + w
		}
		if c > 0 {
			nbs[2] = v - 1
		}
		if c+1 < w {
			nbs[3] = v + 1
		}
		for _, u := range nbs {
			if u < 0 || g[u] == '#' {
				continue
			}
			if u == goal { // 残り 0 で着いてもよい。BFS なので最初に着いた手数が最短
				fmt.Fprintln(out, d)
				return
			}
			ne := e - 1
			if g[u] == 'C' {
				ne = b
			}
			t := u*k + ne
			if dist[t] == -1 {
				dist[t] = d
				queue = append(queue, int32(t))
			}
		}
	}
	fmt.Fprintln(out, -1)
}
