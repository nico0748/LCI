package main

import (
	"bufio"
	"os"
	"strconv"
)

func main() {
	sc := bufio.NewScanner(bufio.NewReader(os.Stdin))
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords) // 絵柄の行は空白を含まないので 1 語として読める
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int { v, _ := strconv.Atoi(next()); return v }
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()

	H, W, N := nextInt(), nextInt(), nextInt()
	canvas := make([][]byte, H)
	for y := range canvas {
		canvas[y] = make([]byte, W)
		for x := range canvas[y] {
			canvas[y][x] = '.'
		}
	}
	for k := 0; k < N; k++ {
		h, w, r, c := nextInt(), nextInt(), nextInt(), nextInt()
		for i := 0; i < h; i++ {
			row := next()
			y := r - 1 + i
			if y < 0 || y >= H {
				continue // 範囲外の添字は panic になるので先に弾く
			}
			for j := 0; j < w; j++ {
				x := c - 1 + j
				if row[j] != '.' && x >= 0 && x < W {
					canvas[y][x] = row[j]
				}
			}
		}
	}
	for _, line := range canvas {
		out.Write(line)
		out.WriteByte('\n')
	}
}
