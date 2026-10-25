package main

import (
	"bufio"
	"fmt"
	"os"
	"sort"
)

func toMin(s string) int {
	return (int(s[0]-'0')*10+int(s[1]-'0'))*60 + int(s[3]-'0')*10 + int(s[4]-'0')
}

func main() {
	in := bufio.NewReader(os.Stdin)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	var n, q int
	fmt.Fscan(in, &n)
	deps := make([]int, n)
	for i := range deps {
		var s string
		fmt.Fscan(in, &s)
		deps[i] = toMin(s)
	}
	sort.Ints(deps) // 時刻表は時刻順とは限らない
	fmt.Fscan(in, &q)
	for j := 0; j < q; j++ {
		var s string
		fmt.Fscan(in, &s)
		u := toMin(s)
		dep, wait := -1, 0
		for _, d := range deps {
			if d >= u { // ちょうどの時刻の便にも乗れる
				dep, wait = d, d-u
				break
			}
		}
		if dep == -1 { // 今日の便はもう無い → 翌日の始発
			dep, wait = deps[0], deps[0]+1440-u
		}
		fmt.Fprintf(out, "%02d:%02d %d\n", dep/60, dep%60, wait)
	}
}
