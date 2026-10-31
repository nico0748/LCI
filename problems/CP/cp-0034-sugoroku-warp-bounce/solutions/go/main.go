package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	in := bufio.NewReader(os.Stdin)
	var n, k int
	fmt.Fscan(in, &n, &k)
	dice := make([]int, k)
	for i := range dice {
		fmt.Fscan(in, &dice[i])
	}
	var m int
	fmt.Fscan(in, &m)
	warp := make([]int, n+1) // 入口 → 出口（-1 はワープなし）
	for i := range warp {
		warp[i] = -1
	}
	for j := 0; j < m; j++ {
		var s, t int
		fmt.Fscan(in, &s, &t)
		warp[s] = t
	}
	pos := 0
	for t, d := range dice {
		pos += d
		if pos > n {
			pos = n - (pos - n) // 越えた分だけ戻る
		}
		if pos == n {
			fmt.Printf("GOAL %d\n", t+1) // 残りの出目は使わない
			return
		}
		if warp[pos] >= 0 {
			pos = warp[pos] // 1 回だけ
		}
	}
	fmt.Println(pos)
}
