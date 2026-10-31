package main

import (
	"bufio"
	"io"
	"os"
	"strconv"
	"strings"
)

const symbols = "!#$%&*+-=?@_"

func judge(user, pw string) string {
	// 規則 1: 長さ
	if len(pw) < 8 || len(pw) > 64 {
		return "1"
	}
	upper, lower, digit, symbol := 0, 0, 0, 0
	for i := 0; i < len(pw); i++ {
		c := pw[i]
		switch {
		case c >= 'A' && c <= 'Z':
			upper = 1
		case c >= 'a' && c <= 'z':
			lower = 1
		case c >= '0' && c <= '9':
			digit = 1
		case strings.IndexByte(symbols, c) >= 0:
			symbol = 1
		default:
			return "2" // 規則 2: 使えない文字
		}
	}
	// 規則 3: 4 種類のうち 3 種類以上
	if upper+lower+digit+symbol < 3 {
		return "3"
	}
	// 規則 4: 同じ文字の 3 連続（数えた直後に判定するので末尾の連続も漏れない）
	run := 1
	for i := 1; i < len(pw); i++ {
		if pw[i] == pw[i-1] {
			run++
		} else {
			run = 1
		}
		if run >= 3 {
			return "4"
		}
	}
	// 規則 5: ユーザー名を含まない（大文字小文字を区別しない）
	if strings.Contains(strings.ToLower(pw), strings.ToLower(user)) {
		return "5"
	}
	return "OK"
}

func main() {
	data, _ := io.ReadAll(bufio.NewReader(os.Stdin))
	lines := strings.Split(string(data), "\n")
	n, _ := strconv.Atoi(strings.TrimSpace(lines[0]))
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	for i := 1; i <= n; i++ {
		sp := strings.IndexByte(lines[i], ' ')
		w.WriteString(judge(lines[i][:sp], lines[i][sp+1:]))
		w.WriteByte('\n')
	}
}
