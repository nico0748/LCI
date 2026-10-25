package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	in := bufio.NewReader(os.Stdin)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	var n int
	fmt.Fscan(in, &n)
	names := make([]string, n)
	scores := make([]int, n)
	total := 0
	for i := 0; i < n; i++ {
		fmt.Fscan(in, &names[i], &scores[i])
		total += scores[i]
	}
	// 整数だけで: 平均×10 の切り捨て（%.1f は四捨五入になるので使わない）
	v := total * 10 / n
	fmt.Fprintf(out, "%d.%d\n", v/10, v%10)
	// 「平均以上」は正確な平均と比べる: score >= total/n ⇔ score*n >= total
	for i := 0; i < n; i++ {
		if scores[i]*n >= total {
			fmt.Fprintln(out, names[i])
		}
	}
}
