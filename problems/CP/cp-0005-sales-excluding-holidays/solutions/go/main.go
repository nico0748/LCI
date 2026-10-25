package main

import (
	"bufio"
	"os"
	"strconv"
)

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	nextInt := func() int {
		sc.Scan()
		v, _ := strconv.Atoi(sc.Text())
		return v
	}
	n, q := nextInt(), nextInt()
	// 累積和を 2 本: ps[i] = 1..i 日目の営業日の売上合計（int は 64bit）、pc[i] = 営業日数
	ps := make([]int, n+1)
	pc := make([]int, n+1)
	for i := 0; i < n; i++ {
		a := nextInt()
		ps[i+1], pc[i+1] = ps[i], pc[i]
		if a >= 0 { // 休業日（-1）は足さない。売上 0 円の営業日は日数に数える
			ps[i+1] += a
			pc[i+1]++
		}
	}
	out := bufio.NewWriterSize(os.Stdout, 1<<16)
	defer out.Flush()
	buf := make([]byte, 0, 32)
	for j := 0; j < q; j++ {
		l, r := nextInt(), nextInt()
		// 両端を含む L..R は「R までの和 − (L−1) までの和」
		buf = strconv.AppendInt(buf[:0], int64(ps[r]-ps[l-1]), 10)
		buf = append(buf, ' ')
		buf = strconv.AppendInt(buf, int64(pc[r]-pc[l-1]), 10)
		buf = append(buf, '\n')
		out.Write(buf)
	}
}
