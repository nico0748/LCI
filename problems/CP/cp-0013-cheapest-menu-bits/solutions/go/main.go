package main

import (
	"bufio"
	"fmt"
	"math/bits"
	"os"
)

func main() {
	in := bufio.NewReader(os.Stdin)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	var n, m int
	fmt.Fscan(in, &n, &m)
	price := make([]int64, n)
	mask := make([]int, n)
	for i := 0; i < n; i++ {
		var k int
		fmt.Fscan(in, &price[i], &k)
		for j := 0; j < k; j++ {
			var a int
			fmt.Fscan(in, &a)
			mask[i] |= 1 << (a - 1) // 栄養 a をビット a-1 に
		}
	}
	full := 1<<m - 1
	size := 1 << n
	cover := make([]int, size)  // 集合 s の栄養の OR
	cost := make([]int64, size) // 集合 s の合計（最大 1.5×10^10 なので int64）
	best, ways := int64(-1), 0
	for s := 1; s < size; s++ {
		low := s & -s // 最下位の 1 ビット = 番号が最小の料理
		i := bits.TrailingZeros(uint(low))
		cover[s] = cover[s^low] | mask[i]
		cost[s] = cost[s^low] + price[i]
		if cover[s] == full {
			if best == -1 || cost[s] < best {
				best, ways = cost[s], 1
			} else if cost[s] == best {
				ways++
			}
		}
	}
	if best == -1 {
		fmt.Fprintln(out, -1)
	} else {
		fmt.Fprintln(out, best, ways)
	}
}
