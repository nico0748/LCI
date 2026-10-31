package main

import (
	"bufio"
	"os"
	"strconv"
)

func main() {
	sc := bufio.NewScanner(bufio.NewReader(os.Stdin))
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	nextInt := func() int64 { sc.Scan(); v, _ := strconv.ParseInt(sc.Text(), 10, 64); return v }
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()

	n, m := int(nextInt()), int(nextInt())
	free := make([]int64, m) // 窓口 k が空く時刻。最大で約 2×10^13 なので int64
	buf := make([]byte, 0, 32)
	for i := 0; i < n; i++ {
		a, d := nextInt(), nextInt()
		s := free[0]
		for _, f := range free {
			if f < s {
				s = f
			}
		}
		if a > s {
			s = a // 案内時刻 = max(到着, 最も早く空く時刻)
		}
		k := 0
		for free[k] > s { // 時刻 s に空いている（free ≤ s）窓口のうち番号最小
			k++
		}
		free[k] = s + d
		buf = strconv.AppendInt(buf[:0], int64(k+1), 10)
		buf = append(buf, ' ')
		buf = strconv.AppendInt(buf, s-a, 10)
		buf = append(buf, '\n')
		out.Write(buf)
	}
}
