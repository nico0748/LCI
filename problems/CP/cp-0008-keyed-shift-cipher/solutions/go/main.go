package main

import (
	"bufio"
	"os"
	"strings"
)

func main() {
	// 暗号文には空白が続くことがあるので、行で読む（行末の \r\n だけ落とす）
	rd := bufio.NewReaderSize(os.Stdin, 1<<20)
	key, _ := rd.ReadString('\n')
	key = strings.TrimSpace(key)
	s, _ := rd.ReadString('\n')
	s = strings.TrimRight(s, "\r\n")
	m := len(key)
	// 結果は []byte に積む（string の += は毎回コピーするので 2×10^5 文字で O(|S|^2) になる）
	out := make([]byte, 0, len(s)+1)
	j := 0 // 鍵の位置。英字を 1 文字戻したときだけ進める
	for i := 0; i < len(s); i++ {
		c := int(s[i])
		k := int(key[j%m] - 'a')
		switch {
		case c >= 'a' && c <= 'z':
			// Go の % は負の数に負を返すので、+26 してから取る
			out = append(out, byte((c-'a'-k+26)%26+'a'))
			j++
		case c >= 'A' && c <= 'Z':
			out = append(out, byte((c-'A'-k+26)%26+'A'))
			j++
		default:
			out = append(out, s[i])
		}
	}
	out = append(out, '\n')
	os.Stdout.Write(out)
}
