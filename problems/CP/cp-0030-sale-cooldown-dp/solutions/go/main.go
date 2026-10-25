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
	nextInt := func() int64 {
		for data[pos] < '0' || data[pos] > '9' {
			pos++
		}
		var x int64
		for pos < len(data) && data[pos] >= '0' && data[pos] <= '9' {
			x = x*10 + int64(data[pos]-'0')
			pos++
		}
		return x
	}
	n, d := int(nextInt()), nextInt()
	// dp[i] = 店 1..i だけを使ったときの割引の最大（最大 2×10^14 なので int64）
	dp := make([]int64, n+1)
	for i := 1; i <= n; i++ {
		a := nextInt()
		take := a
		if j := int64(i) - d; j >= 0 { // 店 i で買うなら、直前に買えるのは店 i−D 以前
			take += dp[j]
		}
		dp[i] = max(dp[i-1], take)
	}
	fmt.Println(dp[n])
}
