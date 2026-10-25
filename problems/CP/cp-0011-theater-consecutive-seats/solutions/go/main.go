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
	var h, w, k int
	fmt.Fscan(in, &h, &w, &k)
	for r := 0; r < h; r++ {
		var row string
		fmt.Fscan(in, &row)
		run := 0 // この列で、いま続いている空席の数（列が変わったら 0 から数え直す）
		for c := 0; c < w; c++ {
			if row[c] == '.' {
				run++
				if run == k {
					fmt.Fprintln(out, r+1, c-k+2) // 左端は c-k+1（0 始まり）→ 1 始まり
					return
				}
			} else {
				run = 0
			}
		}
	}
	fmt.Fprintln(out, -1)
}
