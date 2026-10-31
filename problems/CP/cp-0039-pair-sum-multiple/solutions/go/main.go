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
	n, m := int(nextInt()), nextInt()
	cnt := make(map[int64]int64, n) // M は最大 10^9 なので配列ではなく map
	var ans int64                   // 最大約 2×10^10
	for i := 0; i < n; i++ {
		r := nextInt() % m
		ans += cnt[(m-r)%m] // それまでに見た「組める余り」の袋の数
		cnt[r]++
	}
	fmt.Println(ans)
}
