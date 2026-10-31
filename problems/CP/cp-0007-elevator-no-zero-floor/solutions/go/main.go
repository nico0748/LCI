package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
)

// 0 階が無いので、地下は 1 つずらして詰める: B1→0, B2→-1, B3→-2（地上はそのまま）
func level(s string) int {
	if s[0] == 'B' {
		k, _ := strconv.Atoi(s[1:])
		return 1 - k
	}
	k, _ := strconv.Atoi(s)
	return k
}

func main() {
	in := bufio.NewReader(os.Stdin)
	var n int
	fmt.Fscan(in, &n)
	total, prev := 0, 0
	for i := 0; i < n; i++ {
		var s string
		fmt.Fscan(in, &s)
		cur := level(s)
		if i > 0 {
			d := cur - prev
			if d < 0 {
				d = -d
			}
			total += d
		}
		prev = cur
	}
	fmt.Println(total)
}
