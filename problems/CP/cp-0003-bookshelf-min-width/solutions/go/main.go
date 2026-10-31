package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
)

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	nextInt := func() int64 {
		sc.Scan()
		v, _ := strconv.ParseInt(sc.Text(), 10, 64)
		return v
	}
	n := int(nextInt())
	k := nextInt()
	w := make([]int64, n)
	var lo, hi int64 // 答えは [max(w), Σw] の中。Σw は最大 2×10^14 なので int64
	for i := range w {
		w[i] = nextInt()
		if w[i] > lo {
			lo = w[i]
		}
		hi += w[i]
	}
	// 棚幅 cap で、左から詰めて K 段以内に収まるか（cap ≥ max(w) で呼ぶ）
	fits := func(cap int64) bool {
		count, cur := int64(1), int64(0)
		for _, x := range w {
			cur += x
			if cur > cap {
				count++
				if count > k {
					return false
				}
				cur = x
			}
		}
		return true
	}
	for lo < hi {
		mid := (lo + hi) / 2
		if fits(mid) {
			hi = mid
		} else {
			lo = mid + 1
		}
	}
	fmt.Println(lo)
}
