package main

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"strconv"
)

func isLeap(y int) bool { return y%4 == 0 && (y%100 != 0 || y%400 == 0) }

func daysIn(y, m int) int {
	switch m {
	case 2:
		if isLeap(y) {
			return 29
		}
		return 28
	case 4, 6, 9, 11:
		return 30
	}
	return 31
}

func main() {
	data, _ := io.ReadAll(bufio.NewReader(os.Stdin))
	f := bytes.Fields(data)
	q, _ := strconv.Atoi(string(f[0]))
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	for i := 0; i < q; i++ {
		s := f[1+2*i]
		k, _ := strconv.Atoi(string(f[2+2*i]))
		y, _ := strconv.Atoi(string(s[0:4]))
		m, _ := strconv.Atoi(string(s[5:7]))
		d, _ := strconv.Atoi(string(s[8:10]))
		// time.Date は存在しない日を翌月へ繰り上げるので使わず、月の通し番号で計算する
		idx := y*12 + (m - 1) + k
		ty, tm := idx/12, idx%12+1
		last := daysIn(ty, tm)
		var ey, em, ed int
		switch {
		case d > last: // 同じ日が無い → その月の末日
			ey, em, ed = ty, tm, last
		case d > 1: // 同じ日の前日
			ey, em, ed = ty, tm, d-1
		default: // 1 日の前日は前の月の末日
			ey, em = ty, tm-1
			if tm == 1 {
				ey, em = ty-1, 12
			}
			ed = daysIn(ey, em)
		}
		fmt.Fprintf(w, "%04d/%02d/%02d\n", ey, em, ed)
	}
}
