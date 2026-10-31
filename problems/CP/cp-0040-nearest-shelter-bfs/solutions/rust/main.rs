use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let h: usize = it.next().unwrap().parse().unwrap();
    let w: usize = it.next().unwrap().parse().unwrap();
    let w2 = w + 2; // 周りを壁で囲んだ 1 次元の盤面にして、範囲チェックを省く
    let mut free = vec![false; w2 * (h + 2)];
    let mut queue: Vec<usize> = Vec::with_capacity(h * w); // 多始点 BFS のキュー
    let mut dots = 0usize;
    for i in 0..h {
        let row = it.next().unwrap().as_bytes();
        let base = (i + 1) * w2 + 1;
        for (j, &c) in row.iter().enumerate() {
            match c {
                b'.' => {
                    free[base + j] = true;
                    dots += 1;
                }
                b'S' => queue.push(base + j), // 避難所は距離 0 として最初からキューへ
                _ => {}
            }
        }
    }
    if queue.is_empty() {
        println!("-1 {}", dots);
        return;
    }
    let shelters = queue.len();
    let mut dist = vec![0u32; w2 * (h + 2)];
    let mut far = 0u32;
    let mut head = 0;
    while head < queue.len() {
        let p = queue[head];
        head += 1;
        let d = dist[p] + 1;
        for q in [p - 1, p + 1, p - w2, p + w2] {
            if free[q] {
                free[q] = false;
                dist[q] = d;
                far = far.max(d);
                queue.push(q);
            }
        }
    }
    println!("{} {}", far, dots - (queue.len() - shelters));
}
