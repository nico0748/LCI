package main

import (
	"bufio"
	"fmt"
	"math"
	"os"
)

func main() {
	r := bufio.NewReader(os.Stdin)
	var n, m int
	fmt.Fscan(r, &n, &m)
	xs, ys := make([]float64, n+1), make([]float64, n+1)
	for i := 0; i <= n; i++ {
		fmt.Fscan(r, &xs[i], &ys[i])
	}
	need := make([]int, n+1) // need[b]: b より先に訪れる地点の集合（ビット）
	for j := 0; j < m; j++ {
		var a, b int
		fmt.Fscan(r, &a, &b)
		need[b] |= 1 << a
	}
	d := make([][]float64, n+1)
	for i := range d {
		d[i] = make([]float64, n+1)
		for j := range d[i] {
			d[i][j] = math.Hypot(xs[i]-xs[j], ys[i]-ys[j])
		}
	}
	best := math.Inf(1)
	// 使用済みの集合 mask（ビット 0 は営業所）を持ち、条件を満たす地点だけを次に置く再帰で順列を列挙する
	var dfs func(last, mask, placed int, acc float64)
	dfs = func(last, mask, placed int, acc float64) {
		if placed == n {
			if t := acc + d[last][0]; t < best {
				best = t
			}
			return
		}
		for v := 1; v <= n; v++ {
			if mask&(1<<v) != 0 || need[v]&^mask != 0 {
				continue
			}
			dfs(v, mask|1<<v, placed+1, acc+d[last][v])
		}
	}
	dfs(0, 1, 0, 0)
	fmt.Printf("%.10f\n", best)
}
