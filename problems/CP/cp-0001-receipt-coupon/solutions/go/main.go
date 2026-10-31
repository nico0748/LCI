package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	in := bufio.NewReader(os.Stdin)
	var n, x, y int
	fmt.Fscan(in, &n, &x, &y)
	s := 0
	for i := 0; i < n; i++ {
		var name string // 品名は使わない
		var p, q int
		fmt.Fscan(in, &name, &p, &q)
		s += p * q
	}
	// クーポンは「X 円以上」で使える。割引後は 0 円で止める
	t := s
	if s >= x {
		t = s - y
		if t < 0 {
			t = 0
		}
	}
	// 税は整数で切り捨てる（t >= 0 なので整数の / が切り捨てになる）
	fmt.Println(t + t*10/100)
}
