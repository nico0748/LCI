package main

import (
	"bufio"
	"bytes"
	"io"
	"os"
)

func main() {
	data, _ := io.ReadAll(bufio.NewReader(os.Stdin))
	s := bytes.TrimSpace(data)
	// stack[len-1] は今いる括弧の中で、ここまでに展開した文字列
	stack := [][]byte{{}}
	counts := []int{} // 開いている括弧ごとの回数
	isDigit := func(c byte) bool { return c >= '0' && c <= '9' }
	for i := 0; i < len(s); {
		ch := s[i]
		top := len(stack) - 1
		switch {
		case isDigit(ch):
			k := 0
			for isDigit(s[i]) { // 回数は複数桁（例: 999a、12(…)）
				k = k*10 + int(s[i]-'0')
				i++
			}
			if s[i] == '(' {
				counts = append(counts, k)
				stack = append(stack, []byte{})
			} else { // 直後の 1 文字だけを k 個
				stack[top] = append(stack[top], bytes.Repeat([]byte{s[i]}, k)...)
			}
			i++
		case ch == ')':
			body := stack[top]
			stack = stack[:top]
			k := counts[len(counts)-1]
			counts = counts[:len(counts)-1]
			stack[top-1] = append(stack[top-1], bytes.Repeat(body, k)...)
			i++
		default:
			stack[top] = append(stack[top], ch)
			i++
		}
	}
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	w.Write(stack[0])
	w.WriteByte('\n')
}
