package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
)

func main() {
	data, _ := io.ReadAll(bufio.NewReader(os.Stdin))
	pos := 0
	nextInt := func() int {
		for data[pos] < '0' || data[pos] > '9' {
			pos++
		}
		x := 0
		for pos < len(data) && data[pos] >= '0' && data[pos] <= '9' {
			x = x*10 + int(data[pos]-'0')
			pos++
		}
		return x
	}
	const day = 86400
	n := nextInt()
	// いもす法: [s, t) にいるので diff[s]++, diff[t]--。t = 86400 があるので 86401 要素
	diff := make([]int, day+1)
	for i := 0; i < n; i++ {
		s, t := nextInt(), nextInt()
		diff[s]++
		diff[t]--
	}
	cur, peak, first, seconds := 0, -1, -1, 0
	for x := 0; x < day; x++ {
		cur += diff[x]
		if cur > peak {
			peak, first, seconds = cur, x, 1
		} else if cur == peak {
			seconds++
		}
	}
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	fmt.Fprintf(w, "%d\n%d\n%d\n", peak, first, seconds)
}
