package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	in := bufio.NewReaderSize(os.Stdin, 1<<20)
	var h, w int
	fmt.Fscan(in, &h, &w)
	w2 := w + 2 // 周りを壁で囲んだ 1 次元の盤面にして、範囲チェックを省く
	free := make([]bool, w2*(h+2))
	queue := make([]int32, 0, h*w) // 多始点 BFS のキュー
	dots := 0
	for i := 0; i < h; i++ {
		var row string
		fmt.Fscan(in, &row)
		base := (i+1)*w2 + 1
		for j := 0; j < w; j++ {
			switch row[j] {
			case '.':
				free[base+j] = true
				dots++
			case 'S':
				queue = append(queue, int32(base+j)) // 避難所は距離 0 として最初からキューへ
			}
		}
	}
	if len(queue) == 0 {
		fmt.Println(-1, dots)
		return
	}
	shelters := len(queue)
	dist := make([]int32, w2*(h+2))
	step := [4]int{-1, 1, -w2, w2}
	var far int32
	for head := 0; head < len(queue); head++ {
		p := int(queue[head])
		d := dist[p] + 1
		for _, s := range step {
			if q := p + s; free[q] {
				free[q] = false
				dist[q] = d
				if d > far {
					far = d
				}
				queue = append(queue, int32(q))
			}
		}
	}
	fmt.Println(far, dots-(len(queue)-shelters))
}
