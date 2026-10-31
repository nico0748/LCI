package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"
)

func main() {
	data, _ := io.ReadAll(bufio.NewReader(os.Stdin))
	f := strings.Fields(string(data))
	k := 0
	next := func() string { k++; return f[k-1] }
	atoi := func(s string) int { v, _ := strconv.Atoi(s); return v }
	n, m := atoi(next()), atoi(next())
	points := make([]int, m)
	for j := range points {
		points[j] = atoi(next())
	}
	type stamp struct {
		name string
		c    int
	}
	seen := map[stamp]bool{} // (名前, 地点) を 1 回だけ数える
	score := map[string]int{}
	for i := 0; i < n; i++ {
		name, c := next(), atoi(next())
		if seen[stamp{name, c}] {
			continue
		}
		seen[stamp{name, c}] = true
		score[name] += points[c-1]
	}
	type row struct {
		name string
		s    int
	}
	rows := make([]row, 0, len(score))
	for name, s := range score { // map の反復順は毎回変わるので、必ず並べ替えてから出す
		rows = append(rows, row{name, s})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].s != rows[j].s {
			return rows[i].s > rows[j].s
		}
		return rows[i].name < rows[j].name
	})
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	for i := 0; i < len(rows) && i < 3; i++ {
		fmt.Fprintf(w, "%s %d\n", rows[i].name, rows[i].s)
	}
}
