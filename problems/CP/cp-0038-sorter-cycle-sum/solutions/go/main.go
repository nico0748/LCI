package main

import (
	"bufio"
	"fmt"
	"os"
)

const MOD = 1_000_000_007

func main() {
	rd := bufio.NewReaderSize(os.Stdin, 1<<20)
	nextInt := func() int64 {
		var x int64
		c, _ := rd.ReadByte()
		for c == ' ' || c == '\n' || c == '\r' {
			c, _ = rd.ReadByte()
		}
		for ; c >= '0' && c <= '9'; c, _ = rd.ReadByte() {
			x = x*10 + int64(c-'0')
		}
		return x
	}
	n := int(nextInt())
	k := nextInt() // 10^18 < 9.2×10^18 なので int64 で読める
	t := make([]int32, n+1)
	a := make([]int64, n+1)
	for i := 1; i <= n; i++ {
		t[i] = int32(nextInt())
	}
	for i := 1; i <= n; i++ {
		a[i] = nextInt()
	}
	first := make([]int32, n+1)
	for i := range first {
		first[i] = -1
	}
	order := make([]int32, 0, n)
	x := int32(1)
	for first[x] < 0 {
		first[x] = int32(len(order))
		order = append(order, x)
		x = t[x]
	}
	mu := int64(first[x])              // 尾の長さ
	lam := int64(len(order)) - mu      // 周期の長さ
	pre := make([]int64, len(order)+1) // 最大 2×10^14
	for j, v := range order {
		pre[j+1] = pre[j] + a[v]
	}
	if k <= int64(len(order)) {
		fmt.Println(t[order[k-1]], pre[k]%MOD)
		return
	}
	q, r := (k-mu)/lam, (k-mu)%lam
	cyc := (pre[mu+lam] - pre[mu]) % MOD
	total := (pre[mu+r]%MOD + q%MOD*cyc) % MOD // q も周期の和も mod してから掛ける（積は約 10^18）
	fmt.Println(order[mu+r], total)
}
