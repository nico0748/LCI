package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<22) // 命令列は 1 行に最大 10^5 文字
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	var h, w int
	fmt.Sscan(next(), &h)
	fmt.Sscan(next(), &w)
	grid := make([]string, h)
	r, c := 0, 0
	for i := 0; i < h; i++ {
		grid[i] = next()
		if j := strings.IndexByte(grid[i], 'S'); j >= 0 {
			r, c = i, j
		}
	}
	next() // N（命令列の長さから分かるので読み飛ばす）
	cmds := next()
	// 向き 0=北 1=東 2=南 3=西。L は (d + 3) % 4（Go の % は負の数に負を返すので d - 1 は使わない）
	dr := [4]int{-1, 0, 1, 0}
	dc := [4]int{0, 1, 0, -1}
	seen := make([]bool, h*w)
	seen[r*w+c] = true // 出発マスも数える
	count := 1
	d := 0
	for k := 0; k < len(cmds); k++ {
		switch cmds[k] {
		case 'F':
			nr, nc := r+dr[d], c+dc[d]
			if nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] != '#' {
				r, c = nr, nc
				if !seen[r*w+c] {
					seen[r*w+c] = true
					count++
				}
			}
		case 'R':
			d = (d + 1) % 4
		default:
			d = (d + 3) % 4
		}
	}
	fmt.Printf("%d %d\n%d\n", r+1, c+1, count)
}
