package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	r := bufio.NewReaderSize(os.Stdin, 1<<20)
	var n int
	var k int64
	fmt.Fscan(r, &n, &k)
	seen := make(map[int64]int, n)
	for j := 0; j < n; j++ {
		var x int64
		fmt.Fscan(r, &x)
		if i, ok := seen[k-x]; ok {
			fmt.Println(i+1, j+1)
			return
		}
		if _, ok := seen[x]; !ok {
			seen[x] = j
		}
	}
	fmt.Println(-1)
}
