package main

import (
	"bufio"
	"fmt"
	"os"
	"sort"
)

func main() {
	in := bufio.NewReaderSize(os.Stdin, 1<<20)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	readInt := func() int64 {
		n, c := int64(0), byte(0)
		for c, _ = in.ReadByte(); c == ' ' || c == '\n' || c == '\r'; c, _ = in.ReadByte() {
		}
		for ; c >= '0' && c <= '9'; c, _ = in.ReadByte() {
			n = n*10 + int64(c-'0')
		}
		return n
	}
	n := int(readInt())
	c := readInt()
	type booking struct{ s, e int64 }
	bk := make([]booking, n)
	for i := range bk {
		bk[i].s = readInt()
		bk[i].e = readInt()
	}
	sort.Slice(bk, func(i, j int) bool { return bk[i].e < bk[j].e }) // 終了時刻の早い順
	var freeAt int64                                                 // 次の予約が始まってよい最も早い時刻 = 直前の終了 + C（最大 3×10^9 なので int64）
	cnt := 0
	for _, b := range bk {
		if b.s >= freeAt { // ちょうど「終了 + C」に始まる予約は受けられる
			cnt++
			freeAt = b.e + c
		}
	}
	fmt.Fprintln(out, cnt)
}
