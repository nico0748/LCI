package main

import (
	"bufio"
	"os"
	"strconv"
)

const P = 998244353

func power(a, e int) int {
	r := 1
	a %= P
	for e > 0 {
		if e&1 == 1 {
			r = r * a % P
		}
		a = a * a % P
		e >>= 1
	}
	return r
}

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	nextInt := func() int {
		sc.Scan()
		v, _ := strconv.Atoi(sc.Text())
		return v
	}
	q := nextInt()
	ns := make([]int, q)
	rs := make([]int, q)
	m := 0
	for i := 0; i < q; i++ {
		ns[i], rs[i] = nextInt(), nextInt()
		if ns[i] > m {
			m = ns[i]
		}
	}
	// 階乗と、その逆元（フェルマーの小定理: a^(P−2)）を n の最大値まで前計算する。int は 64bit なので積 < P^2 が収まる
	fact := make([]int, m+1)
	inv := make([]int, m+1)
	fact[0] = 1
	for i := 1; i <= m; i++ {
		fact[i] = fact[i-1] * i % P
	}
	inv[m] = power(fact[m], P-2)
	for i := m; i >= 1; i-- {
		inv[i-1] = inv[i] * i % P
	}
	out := bufio.NewWriterSize(os.Stdout, 1<<16)
	defer out.Flush()
	buf := make([]byte, 0, 16)
	for i := 0; i < q; i++ {
		n, r := ns[i], rs[i]
		ans := 0
		if r <= n {
			ans = fact[n] * inv[r] % P * inv[n-r] % P
		}
		buf = strconv.AppendInt(buf[:0], int64(ans), 10)
		buf = append(buf, '\n')
		out.Write(buf)
	}
}
