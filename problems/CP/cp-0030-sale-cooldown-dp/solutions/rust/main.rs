use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|x| x.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let d = it.next().unwrap(); // D は最大 10^9
    // dp[i] = 店 1..i だけを使ったときの割引の最大（最大 2×10^14 なので i64）
    let mut dp = vec![0i64; n + 1];
    for i in 1..=n {
        let a = it.next().unwrap();
        let j = i as i64 - d; // 店 i で買うなら、直前に買えるのは店 i−D 以前
        let take = a + if j >= 0 { dp[j as usize] } else { 0 };
        dp[i] = dp[i - 1].max(take);
    }
    println!("{}", dp[n]);
}
