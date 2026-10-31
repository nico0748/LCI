package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"sort"
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
	n := int(nextInt())
	type event struct{ t, d int64 }
	ev := make([]event, 0, 2*n)
	for i := 0; i < n; i++ {
		s, e, c := nextInt(), nextInt(), nextInt()
		ev = append(ev, event{s, c}, event{e, -c})
	}
	// 時刻の昇順。同じ時刻は終了（負の増減）を先に処理する
	sort.Slice(ev, func(i, j int) bool {
		if ev[i].t != ev[j].t {
			return ev[i].t < ev[j].t
		}
		return ev[i].d < ev[j].d
	})
	var cur, best, at int64 = 0, -1, -1
	for _, e := range ev {
		cur += e.d // 合計は最大 10^14 なので int64
		if cur > best {
			best, at = cur, e.t
		}
	}
	fmt.Printf("%d %d\n", best, at)
}
