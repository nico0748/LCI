package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	in := bufio.NewReaderSize(os.Stdin, 1<<20)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	var h, w int
	fmt.Fscan(in, &h, &w)
	w2 := w + 2
	// 周りを壁で 1 周囲んだ 1 次元の盤。true = 未訪問の空き区画
	g := make([]bool, (h+2)*w2)
	for r := 1; r <= h; r++ {
		var s string
		fmt.Fscan(in, &s)
		for c := 0; c < w; c++ {
			g[r*w2+c+1] = s[c] == '.'
		}
	}
	stack := make([]int32, 0, 1024) // 再帰ではなく明示的なスタック
	count, best := 0, 0
	for v := w2; v < (h+1)*w2; v++ {
		if !g[v] {
			continue
		}
		count++
		g[v] = false // 訪問済みの印は積むときに付ける
		stack = append(stack[:0], int32(v))
		area := 0
		for len(stack) > 0 {
			x := int(stack[len(stack)-1])
			stack = stack[:len(stack)-1]
			area++
			for _, y := range [4]int{x - 1, x + 1, x - w2, x + w2} {
				if g[y] {
					g[y] = false
					stack = append(stack, int32(y))
				}
			}
		}
		if area > best {
			best = area
		}
	}
	fmt.Fprintln(out, count, best)
}
