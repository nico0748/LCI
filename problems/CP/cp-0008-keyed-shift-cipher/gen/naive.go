// 素朴解（TLE させる想定）: 復号した文字を string の += で 1 文字ずつ連結する。
// Go の string は不変なので、+= のたびに新しい文字列へ全体をコピーする。|S| = 2×10^5 では約 2×10^10 バイトのコピーになり、
// hidden-max-* で制限を超える（このコンテナで約 6 秒）。剰余の扱いなど、それ以外は正しい。
package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

func main() {
	rd := bufio.NewReaderSize(os.Stdin, 1<<20)
	key, _ := rd.ReadString('\n')
	key = strings.TrimSpace(key)
	s, _ := rd.ReadString('\n')
	s = strings.TrimRight(s, "\r\n")
	res := ""
	j := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		k := int(key[j%len(key)] - 'a')
		if c >= 'a' && c <= 'z' {
			res += string(rune((int(c-'a')-k+26)%26 + 'a'))
			j++
		} else if c >= 'A' && c <= 'Z' {
			res += string(rune((int(c-'A')-k+26)%26 + 'A'))
			j++
		} else {
			res += string(c)
		}
	}
	fmt.Println(res)
}
