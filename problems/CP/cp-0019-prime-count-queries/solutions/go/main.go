package main

import (
	"bufio"
	"os"
	"strconv"
)

func main() {
	in := bufio.NewReaderSize(os.Stdin, 1<<20)
	out := bufio.NewWriterSize(os.Stdout, 1<<20)
	defer out.Flush()
	readInt := func() int {
		n, c := 0, byte(0)
		for c, _ = in.ReadByte(); c == ' ' || c == '\n' || c == '\r'; c, _ = in.ReadByte() {
		}
		for ; c >= '0' && c <= '9'; c, _ = in.ReadByte() {
			n = n*10 + int(c-'0')
		}
		return n
	}
	q := readInt()
	lo, hi := make([]int, q), make([]int, q)
	n := 1
	for i := 0; i < q; i++ {
		lo[i], hi[i] = readInt(), readInt()
		if hi[i] > n {
			n = hi[i]
		}
	}
	// エラトステネスの篩（composite[x] = true なら合成数。0 と 1 は素数でない）
	composite := make([]bool, n+1)
	composite[0], composite[1] = true, true
	for i := 2; i*i <= n; i++ {
		if !composite[i] {
			for j := i * i; j <= n; j += i {
				composite[j] = true
			}
		}
	}
	// pre[x] = 1..x の素数の個数。[L, R] の個数は pre[R] - pre[L-1]
	pre := make([]int32, n+1)
	for x := 1; x <= n; x++ {
		pre[x] = pre[x-1]
		if !composite[x] {
			pre[x]++
		}
	}
	buf := make([]byte, 0, 16)
	for i := 0; i < q; i++ {
		buf = strconv.AppendInt(buf[:0], int64(pre[hi[i]]-pre[lo[i]-1]), 10)
		buf = append(buf, '\n')
		out.Write(buf)
	}
}
