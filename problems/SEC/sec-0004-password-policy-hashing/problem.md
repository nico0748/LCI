---
id: sec-0004
slug: password-policy-hashing
title: パスワードポリシー検査とハッシュ化
category: SEC
tier: core
difficulty: L3
time_limit: 30
languages: [python, typescript]
tags:
  company_style: [m3]
  nfr: [validation, i18n]
  security: [secrets]
  talk_focus: [requirements_clarify, tradeoff, failure_mode]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: password.py
    language: python
    content_ref: starter/python/password.py
  - path: password.ts
    language: typescript
    content_ref: starter/typescript/password.ts
talking_points:
  - id: tp1
    text: 記号や大文字を必須にする文字種ルールは NIST SP 800-63B で非推奨で、長さと漏えい済みパスワードの照合を優先する
    weight: 3
  - id: tp2
    text: 検査とハッシュの前に NFKC 正規化し、全角の ｐａｓｓｗｏｒｄ と password を同じものとして扱う
    weight: 2
  - id: tp3
    text: パスワードごとにランダムな salt を付け、PBKDF2 の反復回数で総当たりのコストを上げる（SHA-256 一回では速すぎる）
    weight: 3
  - id: tp4
    text: 保存形式に アルゴリズム$反復回数$salt$hash を含め、needs_rehash でログイン時に強いパラメータへ移行できるようにする
    weight: 2
  - id: tp5
    text: 照合は hmac.compare_digest / timingSafeEqual の定数時間比較にし、壊れた保存値は例外でなく不一致として扱う
    weight: 1
  - id: tp6
    text: 上限長を設けるのはハッシュ計算による DoS を防ぐためで、bcrypt なら 72 バイトで切り捨てられる点にも触れる
    weight: 1
requirements:
  - id: length
    label: 12 文字未満と 128 文字超のパスワードを拒否する（文字数は正規化後の Unicode 文字で数える）
  - id: common
    label: よく使われるパスワードは大文字小文字や全角半角の違いがあっても拒否する
  - id: personal
    label: ユーザー ID やメールアドレスのローカル部を含むパスワードを拒否する
  - id: no_composition
    label: 記号・数字・大文字が無いことを理由に拒否しない（長いパスフレーズや日本語を受け入れる）
  - id: hash_verify
    label: 同じパスワードでも保存値は毎回異なり、正しいパスワードだけが照合に成功する
  - id: rehash
    label: 古い設定で保存されたハッシュを検出でき、壊れた保存値で例外にならない
rubric_hints:
  correctness: "hash_verify と length/common のテストが通れば合格ライン。cross-language の固定ベクタが合えば保存形式も正しい"
  explanation: "tp1（文字種ルールを入れない理由）を自分から言えるか。tp3 で『なぜ遅いハッシュが必要か（漏えい後のオフライン総当たり）』まで言えれば加点"
  time_management: "15 分時点でポリシー検査が終わり、ハッシュに着手していること。needs_rehash は最後でよい"
  red_flags:
    - "sha256(password) を 1 回だけ計算して保存している"
    - "salt を固定値・ユーザー名にしている"
    - "== で hash を比較している"
    - "記号必須などの文字種ルールを根拠なく追加する"
  checklist: []
reference_solutions:
  python: solutions/python/password.py
  typescript: solutions/typescript/password.ts
source:
  origin: "04 §2.2 SEC 代表例（パスワードハッシュ）を元に手書き。NIST SP 800-63B と OWASP Password Storage Cheat Sheet の推奨値を参照"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "既定の反復回数 600,000 は OWASP の PBKDF2-HMAC-SHA256 推奨値（2023）。推奨値は年々上がるので見直しが要る"
    - "漏えいパスワード照合は小さな固定リストで代用している（本番は HIBP の k-匿名 API や大規模リスト）"
---

## 問題文

医療機関向けサービスで会員登録を作り直します。パスワードまわりを任せたいです。

1. `check_password(password, user_id, email)` は、受け入れられない理由のコード一覧を返します（空なら OK）。どんなルールにするかは説明してください。最低限、短すぎるもの・長すぎるもの・よく使われるもの・自分の ID やメールを含むものは駄目です。
2. `hash_password(password)` は DB に保存する文字列を、`verify_password(password, stored)` は照合結果を返します。
3. 将来もっと強い設定に変えたとき、古い設定のハッシュをログイン時に作り直せるよう `needs_rehash(stored)` も用意してください。

何から守るのかを説明しながら書いてください。

## 制約

- 理由コード（この順で返す）: `too_short`（12 文字未満）、`too_long`（128 文字超）、`common`（`COMMON_PASSWORDS` に一致）、`contains_user_info`（3 文字以上の user_id またはメールのローカル部を含む）、`repetitive`（同じ文字が 4 回以上連続）。比較はすべて NFKC 正規化と小文字化の後、文字数はコードポイントで数える。
- 保存形式: `pbkdf2_sha256$<反復回数>$<salt の base64>$<hash の base64>`。HMAC-SHA256、salt 16 バイト、出力 32 バイト、既定の反復回数 600000。ハッシュ対象は NFKC 正規化したパスワードの UTF-8。
- `hash_password(password, iterations=600000, salt=None)` / TypeScript は `hashPassword(password, { iterations?, salt? })`。`salt` はテスト用。
- `verify_password` は壊れた保存値に対して False を返す（例外にしない）。`needs_rehash(stored, iterations=600000)`。
- Python は `password.py`、TypeScript は `password.ts`（`checkPassword(password, { userId, email })` など camelCase）。標準ライブラリのみ。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- ポリシーについて「記号必須にしますか？」と聞かれたら「どう思いますか」と返す。NIST の現行推奨（文字種ルールを課さない、漏えい済みリストで照合、定期変更を強制しない）を知っているかを見る。
- 想定質問と答え:
  - 「なぜ SHA-256 ではいけない？」→ 速すぎる。漏えいしたハッシュをオフラインで GPU 総当たりされる。PBKDF2/bcrypt/scrypt/Argon2 のような遅い関数。
  - 「salt は何のため？」→ 同じパスワードが同じハッシュにならないようにし、事前計算表（レインボーテーブル）と一括攻撃を防ぐ。
  - 「反復回数を上げたら既存ユーザーは？」→ 保存値に回数が入っているので照合はでき、ログイン成功時に needs_rehash を見て作り直す。
  - 「上限 128 文字の理由は？」→ 長大な入力でハッシュ計算を重くする DoS。bcrypt の 72 バイト切り捨て。
  - 「全角で入力されたら？」→ NFKC で正規化。正規化しないと端末の IME 設定でログインできなくなる。
  - 「ペッパー（サーバー側の秘密）は？」→ DB だけ漏れた場合に有効。鍵管理とローテーションが課題。
- ヒントの出し順: (1) 「DB が丸ごと漏れたとき、攻撃者は 1 秒に何回試せますか」 (2) 「2 人が同じパスワードだったら保存値は？」 (3) 「反復回数を変えたら、今の保存値は照合できますか」
- 30 分で全部は厳しい。ポリシー→ハッシュ→照合→再ハッシュの順に優先順位を宣言できればよい。

## 振り返り用解説（終了後のみ表示）

**想定解答**: `normalize = lambda s: unicodedata.normalize("NFKC", s)`。ポリシーは正規化後の文字列 `p` と `p.lower()` で各条件を判定し、決めた順に理由コードを積む。ハッシュは `salt = os.urandom(16)`、`dk = hashlib.pbkdf2_hmac("sha256", p.encode(), salt, iterations, 32)`、`f"pbkdf2_sha256${iterations}${b64(salt)}${b64(dk)}"`。照合は保存値を `$` で 4 分割し、アルゴリズム名と反復回数を検査してから同じ salt と回数で再計算し `hmac.compare_digest`。どこかで失敗したら False。`needs_rehash` は形式が壊れている・アルゴリズムが違う・回数が現在値未満なら True。

**別解 A: Argon2id / bcrypt を使う**。メモリハードな Argon2id は GPU/ASIC 耐性が高く、OWASP の第一推奨。ただし標準ライブラリに無いので本問では PBKDF2 を指定した。bcrypt は 72 バイトで切り捨てるため、長いパスフレーズを許すなら事前に SHA-256 して base64 してから渡す、などの配慮が要る（そのときも pepper の有無を含めて形式を明記する）。

**別解 B: ポリシー検査を外部の漏えい DB に委ねる**。Have I Been Pwned の Pwned Passwords API は SHA-1 の先頭 5 文字だけ送る k-匿名方式で、パスワードそのものを外に出さずに漏えい済みか調べられる。固定リストより網羅的だが、外部 API が落ちたときの扱い（登録を止めるか、通すか）を決める必要がある。
