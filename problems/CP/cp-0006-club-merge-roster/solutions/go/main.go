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
	parent := make([]int32, n+1)
	size := make([]int32, n+1)
	for i := range parent {
		parent[i] = int32(i)
		size[i] = 1
	}
	// 根を返す。経路半減で木を浅く保つ（反復なので深さを気にしなくてよい）
	find := func(x int32) int32 {
		for parent[x] != x {
			parent[x] = parent[parent[x]]
			x = parent[x]
		}
		return x
	}
	out := bufio.NewWriterSize(os.Stdout, 1<<16)
	defer out.Flush()
	buf := make([]byte, 0, 16)
	for j := 0; j < q; j++ {
		t := nextInt()
		if t == 2 {
			buf = strconv.AppendInt(buf[:0], int64(size[find(int32(nextInt()))]), 10)
			buf = append(buf, '\n')
			out.Write(buf)
			continue
		}
		a, b := find(int32(nextInt())), find(int32(nextInt()))
		if t == 1 {
			if a != b { // 既に同じ組なら何もしない。小さい組を大きい組の下に付ける
				if size[a] < size[b] {
					a, b = b, a
				}
				parent[b] = a
				size[a] += size[b]
			}
		} else if a == b {
			out.WriteString("Yes\n")
		} else {
			out.WriteString("No\n")
		}
	}
}
