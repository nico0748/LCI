package main

import (
	"bufio"
	"fmt"
	"os"
	"sort"
)

type book struct {
	title, genre string
	year, r      int
}

func main() {
	in := bufio.NewReader(os.Stdin)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	var g, n int
	fmt.Fscan(in, &g)
	rank := make(map[string]int, g)
	for i := 0; i < g; i++ {
		var s string
		fmt.Fscan(in, &s)
		rank[s] = i
	}
	fmt.Fscan(in, &n)
	books := make([]book, n)
	for i := range books {
		b := &books[i]
		fmt.Fscan(in, &b.title, &b.genre, &b.year) // 年は int で読む（文字列のままだと "794" > "1200"）
		if r, ok := rank[b.genre]; ok {
			b.r = r
		} else {
			b.r = g // 一覧に無いジャンルは順位 G
		}
	}
	// string の < はバイト順（= 文字コード順）
	sort.Slice(books, func(i, j int) bool {
		a, b := &books[i], &books[j]
		if a.r != b.r {
			return a.r < b.r
		}
		if a.r == g && a.genre != b.genre {
			return a.genre < b.genre
		}
		if a.year != b.year {
			return a.year > b.year
		}
		return a.title < b.title
	})
	for i := range books {
		out.WriteString(books[i].title)
		out.WriteByte('\n')
	}
}
