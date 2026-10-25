package main

import (
	"bufio"
	"io"
	"os"
)

func main() {
	// 標準入力をまとめて読む。出力は bufio.Writer に溜め、最後に Flush する（defer で必ず書き出す）
	data, _ := io.ReadAll(bufio.NewReader(os.Stdin))
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	// 例: fields := strings.Fields(string(data)); n, _ := strconv.Atoi(fields[0])
	// TODO: 入力を解析して答えを求め、fmt.Fprintln(out, ans) で出力する（和は int64）
	_ = data
}
