use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let nums: Vec<usize> = input.split_ascii_whitespace().map(|s| s.parse().unwrap()).collect();
    let q = nums[0];
    let n = (0..q).map(|i| nums[2 + 2 * i]).max().unwrap();
    // エラトステネスの篩（0 と 1 は素数でない）
    let mut is_p = vec![true; n + 1];
    is_p[0] = false;
    if n >= 1 {
        is_p[1] = false;
    }
    let mut i = 2;
    while i * i <= n {
        if is_p[i] {
            let mut j = i * i;
            while j <= n {
                is_p[j] = false;
                j += i;
            }
        }
        i += 1;
    }
    // pre[x] = 1..x の素数の個数。[L, R] の個数は pre[R] - pre[L-1]
    let mut pre = vec![0u32; n + 1];
    for x in 1..=n {
        pre[x] = pre[x - 1] + is_p[x] as u32;
    }
    let mut out = String::with_capacity(q * 7);
    for k in 0..q {
        let (l, r) = (nums[1 + 2 * k], nums[2 + 2 * k]);
        out.push_str(&(pre[r] - pre[l - 1]).to_string());
        out.push('\n');
    }
    io::stdout().write_all(out.as_bytes()).unwrap();
}
