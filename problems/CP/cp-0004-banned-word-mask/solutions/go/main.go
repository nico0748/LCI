package main

import (
	"bufio"
	"io"
	"os"
	"strconv"
	"strings"
)

func main() {
	// 本文には空白が続くことがあるので、空白で区切らず行で読む
	data, _ := io.ReadAll(bufio.NewReader(os.Stdin))
	lines := strings.Split(string(data), "\n")
	n, _ := strconv.Atoi(strings.TrimSpace(lines[0]))
	words := make([]string, n)
	for i := range words {
		words[i] = strings.TrimSpace(lines[1+i])
	}
	s := strings.TrimRight(lines[1+n], "\r")
	// 原文の上で一致を探して印だけ付ける（置き換えた文字列で次の語を探さない。重なった一致も拾う）
	mark := make([]bool, len(s))
	for _, wd := range words {
		for i := 0; i+len(wd) <= len(s); i++ {
			if s[i:i+len(wd)] == wd {
				for j := i; j < i+len(wd); j++ {
					mark[j] = true
				}
			}
		}
	}
	out := []byte(s)
	for i := range out {
		if mark[i] {
			out[i] = '*'
		}
	}
	out = append(out, '\n')
	os.Stdout.Write(out)
}
