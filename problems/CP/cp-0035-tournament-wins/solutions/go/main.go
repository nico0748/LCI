package main

import (
	"bufio"
	"os"
	"strconv"
)

func main() {
	rd := bufio.NewReaderSize(os.Stdin, 1<<20)
	nextInt := func() int {
		x, c := 0, byte(0)
		for c, _ = rd.ReadByte(); c == ' ' || c == '\n' || c == '\r'; c, _ = rd.ReadByte() {
		}
		for ; c >= '0' && c <= '9'; c, _ = rd.ReadByte() {
			x = x*10 + int(c-'0')
		}
		return x
	}
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()

	k := nextInt()
	n := 1 << k
	s := make([]int, n+1)
	for i := 1; i <= n; i++ {
		s[i] = nextInt()
	}
	line := make([]int, n) // 今の回戦に残っている選手番号（表の左から）
	for i := range line {
		line[i] = nextInt()
	}
	wins := make([]int, n+1)
	for len(line) > 1 {
		next := make([]int, 0, len(line)/2)
		for i := 0; i < len(line); i += 2 {
			a, b := line[i], line[i+1]
			w := b
			if s[a] > s[b] || (s[a] == s[b] && a < b) { // 同じ強さなら番号が小さい方
				w = a
			}
			wins[w]++
			next = append(next, w)
		}
		line = next
	}
	out.WriteString(strconv.Itoa(line[0]))
	out.WriteByte('\n')
	for i := 1; i <= n; i++ {
		if i > 1 {
			out.WriteByte(' ')
		}
		out.WriteString(strconv.Itoa(wins[i]))
	}
	out.WriteByte('\n')
}
