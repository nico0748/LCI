package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	in := bufio.NewReader(os.Stdin)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	var h, w, t int
	fmt.Fscan(in, &h, &w, &t)
	g := make([][]byte, h)
	for r := range g {
		var s string
		fmt.Fscan(in, &s)
		g[r] = []byte(s)
	}
	nxt := make([][]byte, h)
	for r := range nxt {
		nxt[r] = make([]byte, w)
	}
	for day := 0; day < t; day++ {
		// 二重バッファ: 判定は前の日の g、書き込みは nxt。最後に入れ替える（nxt := g では同じ配列を指すだけ）
		for r := 0; r < h; r++ {
			copy(nxt[r], g[r])
			for c := 0; c < w; c++ {
				ch := g[r][c]
				if ch == '#' {
					continue
				}
				m := 0 // 上下左右の苔の数（盤の外は数えない）
				if r > 0 && g[r-1][c] == 'o' {
					m++
				}
				if r+1 < h && g[r+1][c] == 'o' {
					m++
				}
				if c > 0 && g[r][c-1] == 'o' {
					m++
				}
				if c+1 < w && g[r][c+1] == 'o' {
					m++
				}
				if ch == '.' {
					if m >= 2 {
						nxt[r][c] = 'o'
					}
				} else if m == 0 || m == 4 {
					nxt[r][c] = '.'
				}
			}
		}
		g, nxt = nxt, g
	}
	for r := 0; r < h; r++ {
		out.Write(g[r])
		out.WriteByte('\n')
	}
}
