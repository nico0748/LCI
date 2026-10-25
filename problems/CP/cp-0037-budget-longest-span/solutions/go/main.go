package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	rd := bufio.NewReaderSize(os.Stdin, 1<<20)
	nextInt := func() int64 {
		var x int64
		c, _ := rd.ReadByte()
		for c == ' ' || c == '\n' || c == '\r' {
			c, _ = rd.ReadByte()
		}
		for ; c >= '0' && c <= '9'; c, _ = rd.ReadByte() {
			x = x*10 + int64(c-'0')
		}
		return x
	}
	n := int(nextInt())
	b := nextInt() // 最大 10^15 なので int64
	a := make([]int64, n)
	for i := range a {
		a[i] = nextInt()
	}
	bestLen, bestL := 0, 0
	var s int64
	l := 0
	for r := 0; r < n; r++ {
		s += a[r]
		for s > b { // 費用は 0 以上なので、左端を進めれば合計は減る
			s -= a[l]
			l++
		}
		if r-l+1 > bestLen { // 同じ長さなら早い開始日を残す
			bestLen, bestL = r-l+1, l+1
		}
	}
	if bestLen == 0 {
		fmt.Println(0)
	} else {
		fmt.Println(bestLen, bestL)
	}
}
