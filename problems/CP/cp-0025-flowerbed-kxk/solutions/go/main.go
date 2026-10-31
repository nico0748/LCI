package main

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"strconv"
)

func main() {
	data, _ := io.ReadAll(bufio.NewReader(os.Stdin))
	f := bytes.Fields(data)
	h, _ := strconv.Atoi(string(f[0]))
	w, _ := strconv.Atoi(string(f[1]))
	k, _ := strconv.Atoi(string(f[2]))
	// S[i*(W+1)+j] = 上 i 行・左 j 列の花の合計（0 の行と列を足した (H+1)×(W+1)）
	w1 := w + 1
	S := make([]int32, (h+1)*w1)
	for i := 0; i < h; i++ {
		g := f[3+i]
		prev, base := i*w1, (i+1)*w1
		var acc int32
		for j := 0; j < w; j++ {
			acc += int32(g[j] - '0')
			S[base+j+1] = S[prev+j+1] + acc
		}
	}
	best, br, bc := int32(-1), 0, 0
	for r := 0; r+k <= h; r++ {
		top, bot := r*w1, (r+k)*w1
		for c := 0; c+k <= w; c++ {
			v := S[bot+c+k] - S[top+c+k] - S[bot+c] + S[top+c]
			if v > best { // 行優先で「より大きいときだけ」更新 → 同点は上・左が残る
				best, br, bc = v, r, c
			}
		}
	}
	fmt.Printf("%d\n%d %d\n", best, br+1, bc+1)
}
