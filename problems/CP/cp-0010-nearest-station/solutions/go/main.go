package main

import (
	"bufio"
	"os"
	"sort"
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
	xs := make([]int, n)
	for i := range xs {
		xs[i] = nextInt()
	}
	sort.Ints(xs)
	out := bufio.NewWriterSize(os.Stdout, 1<<16)
	defer out.Flush()
	buf := make([]byte, 0, 16)
	for j := 0; j < q; j++ {
		h := nextInt()
		// sort.SearchInts は lower_bound と同じ: xs[i] は h 以上で最小の駅（i == n なら無い）
		i := sort.SearchInts(xs, h)
		best := -1
		if i < n {
			best = xs[i] - h
		}
		if i > 0 && (best < 0 || h-xs[i-1] < best) {
			best = h - xs[i-1]
		}
		buf = strconv.AppendInt(buf[:0], int64(best), 10)
		buf = append(buf, '\n')
		out.Write(buf)
	}
}
