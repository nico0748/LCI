package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	in := bufio.NewReader(os.Stdin)
	var n, capW, c int
	fmt.Fscan(in, &n, &capW, &c)
	// dp[k][w] = 冷蔵品 k 個以下・重さ w 以下での報酬の最大（最大約 10^11 なので int64）
	dp := make([][]int64, c+1)
	for k := range dp {
		dp[k] = make([]int64, capW+1)
	}
	for i := 0; i < n; i++ {
		var w, f int
		var v int64
		fmt.Fscan(in, &w, &v, &f)
		if w > capW {
			continue
		}
		// k も重さも大きい方から: 右辺はこの荷物を使う前の値なので、同じ荷物を 2 回使わない
		for k := c; k >= f; k-- {
			row, src := dp[k], dp[k-f]
			for x := capW; x >= w; x-- {
				if cand := src[x-w] + v; cand > row[x] {
					row[x] = cand
				}
			}
		}
	}
	fmt.Println(dp[c][capW])
}
