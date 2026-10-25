# 01 Foundation — DADS を下敷きにした LCI デザイン基盤（トークン・タイポ・コンポーネント）

対象: `/home/user/LCI/apps/web`（Next.js 16 + Tailwind v4）。現行トークンは `apps/web/src/app/globals.css`（11 色＋2 フォント）。
根拠資料（すべて実ファイルで確認）:
- `@digital-go-jp/design-tokens@2.1.0` `dist/tokens.css` / `tokens.d.ts`（以下 **tokens**）
- `@digital-go-jp/tailwind-theme-plugin@2.0.0` `dist/v4.css` / `MIGRATION.md`（以下 **v4.css**）
- `design-system-example-components-react@2.7.0`（MIT）`src/components/*`、`src/docs/development-policy.mdx`、`.agents/skills/component-rules/SKILL.md`（以下 **react**）
- デジタル庁の説明資料 PDF（20260806 meeting「Overview and Features of DADS」, digital.go.jp）を WebFetch で要約確認
- 現行画面 `before/*.png`（home / problems / preflight / interview-live / review の light・dark）
- コントラスト比は `critique/scripts/contrast.mjs`, `critique/scripts/final.mjs`（node, WCAG 2.x 相対輝度式）で計算。データ可視化色は dataviz スキルの `validate_palette.js`（OKLCH 明度帯・CVD ΔE・対面コントラスト）で検証。

ファイルで検証できなかった事項には **（要確認）** を付けた。design.digital.go.jp 本体はこの環境から参照できない。

---

## 1. DADS の設計原則とトークン体系（実ファイルからの要約）

### 1.1 原則
- **アクセシビリティ最優先**: 選択肢が競合したら「よりアクセシブルなものはどれか」で決め、見た目はその後で詰める（説明資料 PDF）。react 版の目標は JIS X 8341-3:2016 と WCAG 2.2 の A・AA 全達成（development-policy.mdx）。追加の配慮として強制カラーモード、視覚効果低減、ブラウザの文字サイズ設定の尊重、スクリーンリーダー検証の 4 点を挙げている。
- **HTML/CSS ネイティブ優先**: `<details>`、`<select>`、`<dialog>` を使い、ARIA は最小限に抑える。ネイティブで足りないものは APG に倣う。
- **抽象化しないコードスニペット**: コンポーネント同士の相互参照、`BaseButton` のような共通化、共有設定への依存を禁止する。利用側がコピーして書き換える前提（component-rules）。
- **トークン以外の値を使わない**: Tailwind 標準の色（`text-blue-500` など）、文字サイズ（`text-xs` など）、角丸（`rounded-md` など）は使用禁止。使ってよいのはプラグインのトークンと `text-white` / `text-black` だけ（component-rules）。

### 1.2 色（primitive → semantic の 2 層）
| 層 | トークン（tokens.css） | 内容 |
|---|---|---|
| Primitive | `--color-primitive-{blue,light-blue,cyan,green,lime,yellow,orange,red,magenta,purple}-{50,100…1200}` | 10 色相 × 13 段階。数字が大きいほど暗い |
| Neutral | `--color-neutral-solid-gray-{50…900, 420, 536}`、`--color-neutral-opacity-gray-*`、`white`、`black` | 無彩色。**420 = #949494 は白地で 3.03:1、536 = #767676 は白地で 4.54:1** になるよう置かれた中間段（下記計算）。どちらも閾値ちょうどに合わせた段 |
| Semantic | `--color-semantic-success-{1,2}`（green-600/800）、`error-{1,2}`（red-800/900）、`warning-yellow-{1,2}`（yellow-700/900）、`warning-orange-{1,2}`（orange-600/800） | 状態色は 4 系統。`-1` は主にアイコン・枠線、`-2` は文字向けの濃い段 |
| Key | `--color-key-{50…1200}` = blue の別名 | ブランド色をここで差し替える設計。主ボタンは `bg-key-900` |

- 情報色の専用トークンは無い。NotificationBanner の info1 は `text-blue-900`、info2 は `text-solid-gray-536` を使う。
- **ダークモードは無い**。tokens / v4.css / react のどこにも dark 用の値や `prefers-color-scheme` が無い。react の `[color-scheme:dark]` は ModalDialog の 1 要素にあるだけ（`[color-scheme:light]` と併用）。説明資料 PDF もダークテーマには触れておらず、扱っているのは強制カラーモードだけ。→ **公式のダークテーマは無い**と判断する（Figma 版は要確認）。

### 1.3 タイポグラフィ
- ファミリ: `'Noto Sans JP', sans-serif`、`'Noto Sans Mono', monospace`。ウェイトは 400 と 700 の 2 段だけ。
- サイズのプリミティブ: 14 / 16 / 17 / 18 / 20 / 22 / 24 / 26 / 28 / 32 / 36 / 45 / 48 / 57 / 64（rem 指定、ルートを 16px とする前提）。
- 行間のプリミティブ: 1.0 / 1.2 / 1.3 / 1.4 / 1.5 / 1.6 / 1.7 / 1.75（v4.css では `leading-100…175`）。
- **複合トークンの命名**は `text-{用途}-{サイズ}{N|B}-{行間×100}`。v4.css の `@utility` で、font-size・font-weight・line-height・letter-spacing をまとめて設定する。

| 接頭辞 | 意味 | サイズ域 | 行間 | 字間 |
|---|---|---|---|---|
| `dsp` | Display（見出し特大） | 48–64 | 1.4 | 0 |
| `std` | Standard（本文・見出し） | 16–45 | 1.4–1.75（例 `std-16N-170`, `std-16N-175`, `std-20B-150`） | 28–36 は 0.01em、26 以下は 0.02em、45 は 0 |
| `dns` | Dense（UI ラベル・表） | 14 / 16 / 17 | 1.2 / 1.3 | 0 |
| `oln` | One-line（ボタンなど 1 行） | 14 / 16 / 17 | 1.0 | 0.02em |
| `mono` | 等幅 | 14 / 16 / 17 | 1.5 | 0 |

- **本文の基準は 16px・行間 1.7**（`std-16N-170`）。14px は `dns` / `oln` / `mono` にしかなく、**`std-14` は存在しない**。DADS の考えでは、14px で長文を組むことは想定していない。

### 1.4 スペーシング・角丸・エレベーション
- **スペーシングのトークンは無い**（tokens.css と v4.css を全行確認）。コンポーネントは Tailwind 標準の 4px 刻み（`px-4`, `py-3`, `gap-x-1`）と、`calc(n/16*1rem)` の任意値（例: 11px は `py-[calc(11/16*1rem)]`）を使う。
- 角丸: `--border-radius-{4,6,8,12,16,24,32,full}`。ボタンの角丸は lg/md 8、sm 6、xs 4。入力欄とチップは 8、通知バナーは 12、プログレスの下地は 16。
- エレベーション: `--elevation-1…8` は 2 層の影 `rgba(0,0,0,.1)` + `rgba(0,0,0,.3)`。ライト背景を前提にした値。react の使用例はメニューの `shadow-1` とダイアログの `shadow-3` だけ。
- ブレークポイント: v4.css には無い。react は `desktop:`（48em）を使うので、利用側で `--breakpoint-desktop: 48em` の定義が必要（MIGRATION.md）。

### 1.5 フォーカスリング（DADS で最も特徴的な資産）
全コンポーネントで次の書式が共通（react の components 配下で 100 箇所超、stories を含む）:
`focus-visible:outline-4 outline-black outline-offset-[2px] ring-[2px] ring-yellow-300`
→ **要素の外周に 2px の黄色 #ffd43d、そのすぐ外に 4px の黒**、という二重リング。どんな背景色でも片方は見える。テキスト系（リンク、`<summary>`、テキストボタン）はフォーカス時に背景も `bg-yellow-300` にする。リスト行は `outline-offset:-3px` の内側リングにする（ResourceList）。Input と Select は `:focus-visible` ではなく `:focus` に付ける（キーボード操作でもマウス操作でも出る）。

### 1.6 最小ターゲットと寸法
- Button の高さ: lg 56 / md 48 / sm 36 / xs 28（`min-h-14/12/9/7`）。**sm と xs は `::after` で縦 44px の当たり判定を足す**（2.5.5 AAA 相当）。
- Input と Select の高さ: lg 56 / md 48 / sm 40。Checkbox: 24 / 32 / 44。ChipLabel: 最小高さ 32。
- PDF 資料は 2.5.8（AA, 24px）と 2.5.5（AAA, 44px）を「達成できる」側に挙げている。

### 1.7 状態表現の共通パターン
- **無効状態は `aria-disabled`**。`disabled` 属性を使わないのでフォーカスは移り、クリックは `preventDefault` で止める。見た目は透明度ではなく明示色で示す（例: Button は `bg-solid-gray-300 text-solid-gray-50`、Input は `bg-solid-gray-50 text-solid-gray-420`）。強制カラーモードでは `GrayText` を使う。
- **エラーは `aria-invalid` で表す**（`border-error-1`、hover で `red-1000`）。読み取り専用は破線の枠。
- **ホバーで下線を付ける**（solid / outline / text の全ボタン、Disclosure の summary、タブ）。押下時は色を 1 段濃くする（key-1000 → 1200）。
- **強制カラーモード対策**: 塗りボタンに `border-4 border-double border-transparent` を付け、ハイコントラストでも輪郭が残るようにしている。
- **状態は `data-*` 属性で持つ**。子要素は `group-data-[...]` で反応する。JS で className を分岐させない。
- **プレースホルダは禁止**: `Input` の型は `placeholder?: never`。ラベルの代わりにプレースホルダを使わせない設計。
- アニメーションには `motion-reduce:![animation:none]` を付ける（ProgressIndicator）。

---

## 2. 批評: 何を採り、何を拡張し、どこで逸脱するか

DADS が前提とする利用者は「フォーム中心の行政サービス」「ライトモード」「端末も習熟度もさまざまな広い層」「タッチ操作を含む」。LCI の前提は「1 人の開発者」「Mac、1280px 以上」「キーボード中心」「IDE 並みの密度」「ダークモードあり」「タイムラインやレーダーなどの可視化」「20〜45 分の連続集中と画面収録」。前提がこれだけ違うので、**色の体系・フォーカス・アクセシビリティの作法は採用し、寸法・密度・装飾は作り直す**。

### 2.1 採用する（そのまま、または値だけ借りる）
| 対象 | 理由 |
|---|---|
| primitive 色階調（50–1200）と neutral 420/536 の考え方 | コントラスト閾値に合わせた段があり、トークン名から AA 可否が読める |
| primitive → semantic の 2 層構造 | 現行 LCI は 1 層だけ（`--warn: #c7730a` を直書き）でダーク差分を持てない |
| `{用途}-{サイズ}{N/B}-{行間}` の命名 | 数値が名前に入っていて、レビューで比較しやすい。LCI の拡張もこの規則で名付ける |
| 黄＋黒の二重フォーカスリング | 現行 LCI は focus スタイルが 0 件で、ブラウザ既定のまま（preflight の画面で青い既定リングを確認）。キーボード中心をうたうなら最優先 |
| `aria-disabled` と明示色による無効表示 | 現行は `disabled:opacity-50`。半透明だと背景次第でコントラストが変わり、フォーカスも失う |
| `<details>` / `<summary>`、`aria-sort`、`scope`、`aria-current`、`role="progressbar"` などの aria の要点 | APG 準拠で、そのまま使える |
| 強制カラーモード（double border、`GrayText`）と reduced-motion の扱い | コストが小さく、損がない |
| プレースホルダをラベル代わりにしない | ProblemBrowser の検索欄「検索（ID・タイトル・タグ）」がまさにそれ |

### 2.2 拡張する（DADS に無いので、DADS の文法で足す）
1. **ダークモード**: 公式が無いので **DADS の primitive から導出**する。方針は次の通り。
   - 無彩色は solid-gray をそのまま裏返すと足りない。900（#1a1a1a）と黒の間に段が無く、IDE 的な面の階層（canvas < surface < raised < hover）を作れない。そこで拡張段 **#0d0d0d / #121212 / #242424 / #2e2e2e** を `lci-gray-*` として明示的に追加する。
   - 有彩色は「ライトで 800〜1000 の段を使う所を、ダークでは 200〜500 に移す」。ダーク背景で深い青を塗りにすると彩度が強すぎるので、塗り面の主ボタンは blue-400 地に blue-1200 の文字（6.34:1）にする。
   - 選択行の背景は primitive に適切な段が無い（blue-1000 #00118f は彩度が強すぎ、長時間見ると疲れる）。**`color-mix(in oklab, blue-500 18%, gray-900)` = #222b41** を派生値として固定し、導出式もトークン定義のコメントに残す。
   - 検証方法: 全トークン対を `final.mjs` で総当たりする（本文 4.5:1、UI 3:1）。画面上は Chrome DevTools の Rendering で `prefers-color-scheme` と `forced-colors` をエミュレートし、axe-core（DADS と同じ手法）で確認する。透明度・`color-mix` を使った色は合成後の値で再計算する。
   - ダークでは影が見えない。浮いた面は「明度を 1 段上げる＋1px の枠線」で表し、影は補助にとどめる。
2. **14px の本文**（要件 04 §7.1）: 3 カラムのペイン（1440px で約 360px 幅）に 16px で組むと 1 行 20 字前後になり、問題文が縦に長くなる。DADS の文法で `std-14N-170` を足す（行間 1.7 と字間 0.02em は std 系の規則に従う）。ページ単位の画面（ホーム、レビューの総評）は DADS 標準の 16px のまま。
3. **密度（compact）**: 高さ 36 / 32 / 28 / 24 の 4 段を足す（§4.2）。DADS の sm（36）を LCI の最大にする。
4. **等幅と数字**: DADS の mono は 14 / 16 / 17 しか無い。LCI はタイムスタンプ、軸目盛、ID、タイマーで 12 / 13 を使うので、`mono-13N-150`、`mono-12N-120`、`mono-16B-100`（タイマー）を足す。数値はすべて `tabular-nums` にする。
5. **状態色**: DADS の 4 系統（success / error / warning-yellow / warning-orange）のうち、LCI は **warning を黄の 1 系統に絞る**。オレンジは赤と近く、P 型・D 型の色覚では major（赤）と minor（橙）のピンが区別できない。代わりに形（◆ / ▲ / ●）とラベルを必ず併記する。info は key（青）を流用する。
6. **録画状態**: DADS に該当するものは無い。§2.4 で定義する。
7. **データ可視化の色**: DADS には categorical / sequential の規定が無い（PDF ではカラーユニバーサルデザイン推奨配色セットを参照しているが、トークンとしては提供していない）。§3.3 で primitive から選び、検証した。

### 2.3 逸脱する（DADS の判断をあえて採らない）
| DADS | LCI | 理由 |
|---|---|---|
| ボタンの既定 48–56px、sm/xs にも 44px の当たり判定 | 既定 32px、当たり判定は最低 24px（2.5.8 AA）。xs は周囲に余白があるときだけ `::after` で 32–40px に広げる | 40px のセッションヘッダに 56px のボタンは入らない。ポインタ精度の高いデスクトップ専用アプリで、操作の主役はキーボードショートカット |
| すべてのボタンがホバーで下線 | 下線はリンクとテキストボタンに限る | 密なツールバーでは下線がノイズになる。セッション中に「動くもの」を増やすことにもなる |
| 主色は key-900 #0017c1 | ライトの主色は key-800 #0031d8（白文字で 8.64:1） | 900 は小さな面（タブのインジケータ、再生ヘッド、ピン）だと黒と見分けにくい。ホバーで 900 を使えば DADS の段構成とも整合する |
| warning-yellow-2 = yellow-900 #927200（白地 4.54） | yellow-1000 #806300 | LCI は canvas が #f2f2f2 で、900 では 4.06 になり AA を割る |
| Tab: 選択中は上辺 6px のバー＋太字、パディング 16px | 下辺 2px のバー、太字にしない、高さ 32px | ファイル名タブ（等幅）は太字にすると幅が変わる。6px バーは IDE には重すぎる |
| 通知バナー: 枠 3px、アイコン 36–44px、角丸 12 | 1 行の compact 版（左に 4px の色帯、アイコン 16px） | セッション中の警告は視線を奪わないこと（04 §7 原則 1） |
| Accordion: 20–32px の円アイコンが回転 | 16px のシェブロン、回転アニメーションなし | 同上。レビュー画面の右カラムにある折り畳みが多い |
| 04 §6.1「カテゴリ色」（9 カテゴリ） | カテゴリは無彩色のコード（FE / BE…）で表し、色は使わない | 9 色だと CVD 検証を通らない（§3.3）。「無彩色＋アクセント 1 色」（04 §7）と矛盾する。色は状態と可視化だけに使う |
| v4.css を `@import` して使う | primitive だけを `--dads-*` 接頭辞で取り込み、`@theme` には LCI の semantic だけを出す | v4.css は `--color-blue-500`、`--shadow-1`、`--font-sans` を**そのまま上書きする**。Tailwind 標準の `blue-500` が別の色になり、現行コードの `bg-white` などとも混線する |

### 2.4 録画中表示（REC）
- 現状の問題: 録画中（`bg-rec` #d6453d）も、録画失敗の「停止」（`bg-danger` #c43d3d）も**赤い 8px の点**で、正常と異常が同じ見た目になっている（InterviewScreen.tsx:500）。
- LCI の仕様:
  - 正常時は `●` を 8px、`--rec` 色で表示し、`REC` は `--fg-muted` の文字にする。点滅させない（04 §7）。
  - 異常時は点の代わりに `▲`（`--warning`）と「録画停止」の文字を出し、ヘッダ直下に compact の NotificationBanner（warning）を 1 本出す。録画は LCI の価値の根幹なので、セッション中でも例外的に目立たせてよい唯一の状態とする。音は鳴らさない。
  - 記録のみ（意図的に録画しない）の場合は `○` を `--fg-muted` で出し、「記録のみ」と表示する。
  - 色だけに頼らない（形と文字が状態ごとに違う）。`aria-label` だけでなく `role="status"` の領域で状態変化を 1 回だけ読み上げる。

### 2.5 現行 LCI の計測結果（`contrast.mjs` の `## current`）
| 現行トークン | 対 bg | 対 bg-elev | 判定 |
|---|---|---|---|
| light `--warn` #c7730a（タイマー文字に使用） | 3.33 | 3.57 | **本文 AA 不合格** |
| light `--ok` #2d8a4e | 4.03 | 4.32 | **AA 不合格** |
| light `--accent` #2f6fed に白文字 | — | 4.55 | 合格ぎりぎり |
| dark `--danger` #c43d3d（ダーク差分が無くライトと同じ値） | 3.58 | 3.27 | **AA 不合格** |
| dark `--ok` #2d8a4e | 4.26 | 3.89 | **AA 不合格** |
| `--border`（light / dark） | 1.20 / 1.32 | — | 枠線は装飾扱いなら許容。入力欄の境界には使えない |

このほか、9–11px の文字（`text-[10px]` 14 箇所、`text-[11px]` 15 箇所、SVG の `fontSize={9|10}`）、ダークでもプレビュー iframe が白一面（interview-live-dark）、レーダーの軸ラベル欠け（review、「トレー」）、ID の折り返し（problems、「data-\n0001」）がある。

---

## 3. LCI トークン案

### 3.1 CSS custom properties（全量）
DADS primitive の名前は `blue-800` のように略記する。`lci-*` は LCI で拡張した値。

| トークン | Light | 対応（L） | Dark | 対応（D） | 用途 |
|---|---|---|---|---|---|
| `--bg-canvas` | #f2f2f2 | gray-50 | #121212 | lci-gray-940 | アプリ全体の地 |
| `--bg-surface` | #ffffff | white | #1a1a1a | gray-900 | ペイン、カード、表、グラフの描画面 |
| `--bg-raised` | #ffffff | white + shadow-1 | #242424 | lci-gray-860 | ポップオーバー、ダイアログ、ツールチップ以外の浮いた面 |
| `--bg-sunken` | #f2f2f2 | gray-50 | #0d0d0d | lci-gray-960 | コードブロック、ペイン内の入れ子 |
| `--bg-hover` | #f2f2f2 | gray-50 | #2e2e2e | lci-gray-820 | 行・項目のホバー（DADS Accordion と同じ） |
| `--bg-selected` | #e8f1fe | blue-50 | #222b41 | 派生 mix(blue-500 18%, gray-900) | 選択行、現在のタブ面、info の地 |
| `--bg-inverse` | #1a1a1a | gray-900 | #f2f2f2 | gray-50 | 再生ヘッドの時刻ラベル、ツールチップ |
| `--fg` | #1a1a1a | gray-900 | #f2f2f2 | gray-50 | 見出し、強調 |
| `--fg-body` | #333333 | gray-800 | #e6e6e6 | gray-100 | 本文（DADS の本文色は gray-800）。ダークは眩しさを抑えて 100 |
| `--fg-muted` | #666666 | gray-600 | #b3b3b3 | gray-300 | 補足、メタ、ラベル。**AA を満たす最も淡い文字色** |
| `--fg-disabled` | #949494 | gray-420 | #666666 | gray-600 | 無効状態（1.4.3 の対象外。3:1 は確保） |
| `--fg-link` | #0017c1 | key-900 | #9db7f9 | blue-300 | リンク、テキストボタン |
| `--fg-on-accent` | #ffffff | white | #000060 | blue-1200 | 主ボタンの文字 |
| `--fg-inverse` | #f2f2f2 | gray-50 | #1a1a1a | gray-900 | `--bg-inverse` の上の文字 |
| `--border-subtle` | #e6e6e6 | gray-100 | #262626 | lci-gray-850 | 装飾的な区切り（1.4.11 の対象外） |
| `--border` | #cccccc | gray-200 | #333333 | gray-800 | ペイン境界、カード枠 |
| `--border-strong` | #949494 | gray-420 | #767676 | gray-536 | 意味を持つ境界（タブ下線、表のヘッダ線、outlined チップ）。**surface 上でのみ** 3:1 |
| `--border-input` | #666666 | gray-600 | #999999 | gray-400 | 入力欄、Select、outline ボタン（DADS Input と同じ gray-600） |
| `--accent` | #0031d8 | key-800 | #7096f8 | blue-400 | 主ボタンの地、選択インジケータ、再生ヘッド、Radar |
| `--accent-hover` | #0017c1 | key-900 | #9db7f9 | blue-300 | 主ボタンのホバー |
| `--accent-active` | #00118f | key-1000 | #c5d7fb | blue-200 | 押下時 |
| `--success` / `-subtle` | #197a4b / #e6f5ec | green-800 (=success-2) / green-50 | #71c598 / #08351f | green-300 / green-1100 | 実装あり、AC、positive |
| `--warning` / `-subtle` | #806300 / #fbf5e0 | yellow-1000 / yellow-50 | #ffd43d / #604b00 | yellow-300 / yellow-1200 | 残り 5 分、minor、言及のみ |
| `--danger` / `-subtle` | #ce0000 / #fdeeee | red-900 (=error-2) / red-50 | #ff7171 / #620000 | red-400 / red-1200 | major、WA、削除 |
| `--danger-hover` | #a90000 | red-1000 | #ff9696 | red-300 | 危険ボタンのホバー |
| `--info` / `-subtle` | = `--accent` / `--bg-selected` | key | 同左 | — | 情報バナー |
| `--rec` | #ec0000 | red-800 (=error-1) | #ff5454 | red-500 | 録画中の点（非テキスト） |
| `--focus-outer` | #000000 | black | #ffd43d | yellow-300 | フォーカスの外側 4px |
| `--focus-inner` | #ffd43d | yellow-300 | #000000 | black | フォーカスの内側 2px（ダークでは内外を入れ替える） |
| `--viz-1…5` | #3460fb #fb5b01 #8843e1 #00a3bf #db00db | blue-600, orange-600, purple-600, cyan-600, magenta-600 | #4979f5 #e25100 #a565f8 #00a3bf #db00db | blue-500, orange-700, purple-500, cyan-600, magenta-600 | categorical（固定順） |
| `--viz-seq-1…4` | #7096f8 #4979f5 #264af4 #0017c1 | blue-400/500/700/900 | #0031d8 #3460fb #7096f8 #c5d7fb | blue-800/600/400/200 | 編集密度（少→多） |
| `--viz-neutral` | #949494 | gray-420 | #767676 | gray-536 | 沈黙、停滞、「その他」 |
| `--shadow-1` | DADS elevation-1 | — | `0 0 0 1px var(--border), 0 2px 8px 1px rgb(0 0 0/.5)` | 派生 | メニュー |
| `--shadow-3` | DADS elevation-3 | — | `0 0 0 1px var(--border), 0 4px 16px 3px rgb(0 0 0/.6)` | 派生 | ダイアログ |
| `--font-sans` / `--font-mono` | §6 | | | | |

移行のための別名（1 リリースだけ残す）: `--bg`→canvas、`--bg-elev`→surface、`--accent-fg`→fg-on-accent、`--warn`→warning、`--ok`→success。`--fg-muted`、`--border`、`--accent`、`--danger`、`--rec` は名前を変えない。

### 3.2 Tailwind v4 マッピング（`globals.css` の構成案）
```css
@import "tailwindcss";
@import "./tokens/dads-primitives.css";   /* tokens.css の primitive を --dads-* に改名した写し（MIT 表記を残す） */
@import "./tokens/lci-semantic.css";      /* :root と dark（prefers-color-scheme / data-theme の両方）で §3.1 の値 */

@theme {
  --color-*: initial;                      /* Tailwind 標準パレットを封じる（DADS component-rules と同じ方針） */
  --color-white: #fff; --color-black: #000; --color-transparent: transparent; --color-current: currentColor;
  --radius-*: initial;
  --radius-4: .25rem; --radius-6: .375rem; --radius-8: .5rem; --radius-12: .75rem; --radius-full: 9999px;
}
@theme inline {
  --color-canvas: var(--bg-canvas);   --color-surface: var(--bg-surface); --color-raised: var(--bg-raised);
  --color-sunken: var(--bg-sunken);   --color-hover: var(--bg-hover);     --color-selected: var(--bg-selected);
  --color-inverse: var(--bg-inverse);
  --color-fg: var(--fg);              --color-fg-body: var(--fg-body);    --color-fg-muted: var(--fg-muted);
  --color-fg-disabled: var(--fg-disabled); --color-link: var(--fg-link); --color-on-accent: var(--fg-on-accent);
  --color-fg-inverse: var(--fg-inverse);
  --color-border-subtle: var(--border-subtle); --color-border: var(--border);
  --color-border-strong: var(--border-strong); --color-border-input: var(--border-input);
  --color-accent: var(--accent); --color-accent-hover: var(--accent-hover); --color-accent-active: var(--accent-active);
  --color-success: var(--success); --color-success-subtle: var(--success-subtle);
  --color-warning: var(--warning); --color-warning-subtle: var(--warning-subtle);
  --color-danger: var(--danger);   --color-danger-subtle: var(--danger-subtle); --color-danger-hover: var(--danger-hover);
  --color-info: var(--info);       --color-info-subtle: var(--info-subtle);
  --color-rec: var(--rec);
  --color-viz-1: var(--viz-1); /* …viz-5, viz-seq-1…4, viz-neutral */
  --shadow-1: var(--shadow-1); --shadow-3: var(--shadow-3);
  --font-sans: var(--font-sans); --font-mono: var(--font-mono);
}
```
- `bg-canvas`、`text-fg-muted`、`border-border-input`、`ring-accent` のように使う。`--text-*: initial` を `@theme` に入れて `text-xs` などを封じるかどうかは、移行の終盤に判断する（それまでは lint の grep で検出する）。
- ダークは現行と同じ「`prefers-color-scheme` ＋ `[data-theme]`」の二重定義にする。semantic 層だけを切り替え、`dark:` バリアントはほぼ使わない。Monaco は `defineTheme('lci-light' | 'lci-dark')` で背景を `--bg-surface` に合わせる（vs-dark の #1e1e1e と #1a1a1a の差は 1.04:1 で、見た目はほぼ同じ）。
- データ可視化は SVG の `fill="var(--viz-1)"` で参照する。**グラフは必ず `--bg-surface` の上に描く**（ライトの canvas #f2f2f2 上では orange 2.84、cyan 2.68 で 3:1 を割る）。

### 3.3 コントラスト検証（WCAG 2.x、`final.mjs` の出力）
**Light — 文字 × 背景**（AA は 4.5:1）
| 文字 \ 背景 | canvas #f2f2f2 | surface #fff | hover #f2f2f2 | selected #e8f1fe |
|---|---|---|---|---|
| fg #1a1a1a | 15.55 | 17.40 | 15.55 | 15.29 |
| fg-body #333 | 11.29 | 12.63 | 11.29 | 11.10 |
| fg-muted #666 | 5.13 | 5.74 | 5.13 | 5.04 |
| link #0017c1 | 9.91 | 11.10 | 9.91 | 9.75 |
| accent #0031d8 | 7.72 | 8.64 | 7.72 | 7.59 |
| success #197a4b | 4.78 | 5.35 | 4.78 | 4.70 |
| warning #806300 | 5.07 | 5.67 | 5.07 | 4.98 |
| danger #ce0000 | 5.18 | 5.79 | 5.18 | 5.09 |

**Dark — 文字 × 背景**
| 文字 \ 背景 | canvas #121212 | surface #1a1a1a | raised #242424 | hover #2e2e2e | selected #222b41 |
|---|---|---|---|---|---|
| fg #f2f2f2 | 16.73 | 15.55 | 13.87 | 12.13 | 12.59 |
| fg-body #e6e6e6 | 15.01 | 13.94 | 12.44 | 10.88 | 11.29 |
| fg-muted #b3b3b3 | 8.93 | 8.30 | 7.40 | 6.48 | 6.72 |
| link #9db7f9 | 9.43 | 8.76 | 7.82 | 6.84 | 7.10 |
| accent #7096f8 | 6.61 | 6.14 | 5.48 | 4.79 | 4.97 |
| success #71c598 | 9.05 | 8.41 | 7.50 | 6.56 | 6.81 |
| warning #ffd43d | 13.15 | 12.21 | 10.89 | 9.53 | 9.89 |
| danger #ff7171 | 7.01 | 6.51 | 5.80 | 5.08 | 5.27 |

**ペア・非テキスト（UI は 3:1）**
| 組み合わせ | Light | Dark |
|---|---|---|
| 主ボタン（on-accent / accent、hover） | 8.64 / 11.10 | 6.34 / 9.05 |
| 危険ボタン（白 / danger、ダークは黒 / danger） | 5.79 | 7.85 |
| 状態色 / 各 subtle 地（success・warning・danger・info） | 4.75・5.20・5.14・7.59 | 6.59・5.89・5.17・7.16 |
| border-input / surface | 5.74 | 6.11 |
| border-strong / surface（canvas） | 3.03（**2.71 ✗**） | 3.83（4.12） |
| rec の点 / surface | 4.60 | 5.51 |
| フォーカスの外側 / surface | 21.00（黒） | 12.21（黄） |
| fg-disabled / surface | 3.03 | 3.03 |
| viz-1…5 / surface | 4.99 3.18 5.33 3.00 4.17 | 4.42 4.48 4.82 5.79 4.17 |

運用ルール（計算から導いたもの）:
- **ライトの canvas の上では `--border-strong` を使わない**（2.71）。意味を持つ境界は `--border-input` を使う。
- ダークで subtle 地（例: warning-subtle #604b00）の上に `--fg-muted` を置くと 4.00 で不合格。**バナー内の文字は `--fg-body` 以上にする**。
- DADS の gray-536（#767676）はライトの canvas 上で 4.06 になる。DADS 自身は白地前提なので問題にならないが、LCI は canvas が灰色なので **AA 用の淡い文字は gray-600 を下限にする**。
- データ可視化の検証（`validate_palette.js`）: categorical の viz-1…4 はライト（surface #fff）とダークで全項目 PASS（ダークの隣接 CVD ΔE は最小 11.1）。viz-5 の magenta は cyan と隣り合うと deutan ΔE 6.5 で WARN になるため、**5 系列目は直接ラベルの併記が必須**。sequential（ライト blue-400→900、ダーク blue-800→200）は単調性・隣接 ΔL・最淡段と面のコントラストすべて PASS。初期案（cyan-900 と green-800 の併用、purple と magenta の隣接）は CVD ΔE 1.0 で FAIL だった。可視化色から緑・赤・黄を外したのは、状態色と混同させないため。

---

## 4. タイポグラフィ・スペーシング・角丸・影・フォーカス・モーション

### 4.1 タイポスケール（DADS 命名、★ は LCI での拡張）
| 用途 | トークン | 値（size / lh / ls / wt） | 使う場所 |
|---|---|---|---|
| ページ見出し | `std-24B-150` | 24 / 1.5 / .02em / 700 | ホーム、問題一覧、レビューの問題名 |
| セクション見出し | `std-20B-150` | 20 / 1.5 / .02em / 700 | 「最近のセッション」「Claude 評価」 |
| パネル見出し | `dns-16B-130` | 16 / 1.3 / 0 / 700 | カードやパネルのタイトル |
| ペイン見出し・小見出し | `dns-14B-130` | 14 / 1.3 / 0 / 700 | 「問題文」「制約」（現行は 12px の muted で弱すぎる） |
| 本文（ページ） | `std-16N-170` | 16 / 1.7 / .02em / 400 | 総評、preflight の説明 |
| 本文（ペイン）★ | `std-14N-170` | 14 / 1.7 / .02em / 400 | 問題文、文字起こし、フィードバック |
| UI ラベル・表のセル | `dns-14N-130` | 14 / 1.3 / 0 / 400 | 表、フィルタ、Dl |
| ボタン | `oln-14B-100`（sm・xs）、`oln-16B-100`（md） | | |
| キャプション ★ | `dns-13N-130` | 13 / 1.3 / 0 / 400 | メタ情報、ヒント。**日本語の最小サイズ** |
| コード ★ | `mono-14N-150`（DADS）、`mono-13N-150` ★ | 14・13 / 1.5 | コードブロック、インラインコード、ID |
| 時刻・軸 ★ | `mono-12N-120` | 12 / 1.2 / 0 | タイムスタンプ、軸目盛。**数字とラテン文字専用で、全体の最小サイズ** |
| タイマー ★ | `mono-16B-100` + tabular | 16 / 1.0 / 700 | セッションヘッダ |
| 指標の数値 ★ | `oln-24B-100` + tabular | 24 / 1.0 / .02em / 700 | MetricsSummary のタイル |
| エディタ | Monaco 14px / lineHeight 21 | 設定で 12–18 | |

- `text-[10px]`、`text-[11px]`、SVG の `fontSize 9/10` は廃止する。グラフ内の文字も日本語は 13px、数字は 12px 以上にする。
- 数値（時刻、指標、件数、分）は `font-variant-numeric: tabular-nums` にする。タイマーは等幅にして、桁の揺れで視線を引かないようにする。
- 太字は 700 だけ（DADS と同じ。現行の `font-medium` / `font-semibold` は 400 か 700 に寄せる）。

### 4.2 スペーシングと密度
- 基準は Tailwind 標準の 4px 単位（`--spacing: .25rem` のまま）で、レイアウトのリズムは 8px（04 §7.1）。DADS にもスペーシングトークンは無いので、作法としては一致する。
- コントロールの高さ:
| サイズ | 高さ | 横パディング | 角丸 | 用途 | DADS との対応 |
|---|---|---|---|---|---|
| md | 36 | 16 | 6 | ページの主操作（開始、評価を依頼） | Button sm |
| sm（既定） | 32 | 12 | 6 | フィルタ、表の操作、レビューのツールバー | なし |
| xs | 28 | 8 | 4 | セッションヘッダ（40px 内） | Button xs |
| icon | 24×24 | — | 4 | 行内のアイコン操作（2.5.8 の下限） | なし |
- 面の寸法: セッションヘッダ 40、タブバー 32、字幕ストリップ 28、ペインのパディング 12（セッション）/ 16（レビュー）、表の行 36（compact）/ 44（標準）、カード間 gap 12。

### 4.3 角丸・影
- 角丸は 4（xs、icon、チップ）/ 6（入力欄、ボタン）/ 8（カード、パネル、ポップオーバー）/ 12（バナー、ダイアログ）/ full（状態の点）。16 以上は使わない。DADS の 8 基準より一段締めて、IDE らしい硬さにする。
- 影はオーバーレイにだけ使う（`shadow-1` はメニュー、`shadow-3` はダイアログ）。ペインやカードは影なしで、枠線と面の明度差で区切る。

### 4.4 フォーカス
```css
/* 標準: DADS 準拠の二重リング。ダークでは内外の色が入れ替わる */
.focus-ring:focus-visible { outline: 4px solid var(--focus-outer); outline-offset: 2px; box-shadow: 0 0 0 2px var(--focus-inner); }
/* compact: 密なツールバーやタブ。外側への張り出しを 4px に抑える */
.focus-ring-compact:focus-visible { outline: 2px solid var(--focus-outer); outline-offset: 2px; box-shadow: 0 0 0 2px var(--focus-inner); }
/* inset: overflow:hidden の中の行やタブ（DADS ResourceList の -3px と同じ） */
.focus-ring-inset:focus-visible { outline: 3px solid var(--focus-outer); outline-offset: -3px; }
/* テキストリンクと summary: 黄地＋黒文字（ダークでも文字は黒に固定、14.74:1） */
.focus-text:focus-visible { background: #ffd43d; color: #000; outline: 4px solid #000; outline-offset: 2px; }
```
- Monaco の内部には適用しない（Monaco 側のフォーカス表示に任せる）。フォーカスの順序は 問題 → エディタ → プレビュー → 終了（04 §7.3）。

### 4.5 モーション
- トークン: `--duration-fast: 120ms`、`--ease-standard: cubic-bezier(.2,0,0,1)`。セッション外で使ってよいのは色と不透明度のフェードだけ。`prefers-reduced-motion: reduce` のときは 0ms にする。
- **セッション中は 0**: `[data-session-live] *, [data-session-live] *::before, [data-session-live] *::after { animation: none !important; transition: none !important; }`。Monaco は `cursorBlinking: "solid"` と `smoothScrolling: false` にする（カーソルの点滅も「動くもの」に数える）。動いてよいのはタイマーの秒と字幕の 1 行だけ。
- スピナー（EvaluationPanel の `animate-spin`）は DADS ProgressIndicator の `motion-reduce` 規則に倣う。セッション中には出さない。

---

## 5. 採用する DADS コンポーネントと LCI 版の仕様

各項目の書き方: **DADS の実装から抜き出した要点** → **LCI 版の仕様**。共通ルールとして、状態は `data-*` で持つ、無効は `aria-disabled`、フォーカスは §4.4 のいずれか。

**Button**（react `Button.tsx`）
- DADS: バリアントは `solid-fill` / `outline` / `text` の 3 種、サイズは `lg|md|sm|xs`。ホバーで key-1000＋下線、押下で key-1200。solid に double border（強制カラーモード対策）。sm/xs は `::after` で 44px の当たり判定。`asChild`（Slot）でリンク化できる。`aria-disabled` 時はクリックを止める。
- LCI: **primary**（solid、`bg-accent text-on-accent`、hover `accent-hover`）、**secondary**（outline、`border-border-input bg-surface text-fg-body`、hover `bg-hover`）、**tertiary**（text、`text-link`、hover で下線）、**danger**（DADS には無い。outline で `text-danger border-danger` にする。確認ダイアログ内だけ solid で `bg-danger`、ダークは文字を黒）。サイズは md / sm / xs / icon（§4.2）。下線のホバーは tertiary だけにする。ショートカットは `title` ではなく `aria-keyshortcuts` と可視の `<kbd>` で示す（セッションヘッダでは hover 時の tooltip で可）。1 画面に primary は 1 個まで。

**Input / Select / SearchBox**
- DADS: Input の高さは sm 40 / md 48 / lg 56、角丸 8、枠 gray-600、hover で黒、`aria-invalid` で error-1、読み取り専用は破線、`placeholder` は型で禁止、`focus`（visible ではない）で二重リング。Select は `appearance-none` で、**矢印は `fill='%231a1a1a'` を埋め込んだ data URI**（ダークでは見えなくなる）。SearchBox は grid（`fields submit / detail`）で、虫眼鏡アイコンは `aria-hidden`、ラベルは `sr-only`、`::-webkit-search-cancel-button` は隠す。
- LCI: 高さ 32（sm）/ 36（md）、角丸 6、`border-border-input bg-surface`。Select の矢印は data URI をやめ、`mask-image` と `background-color: currentColor` で描いてダークに追従させる。問題一覧の検索は SearchBox の構成を使い、送信ボタンは置かない（即時絞り込み）。ラベルは「検索」と見える形で出し、`/` キーの案内を `<kbd>` で添える。プレースホルダには例だけを書き、ラベルの代わりにしない。フィルタの Select 群は「カテゴリ: すべて」のような値込みの表示をやめ、ラベルと値を分ける。

**Tab**
- DADS: `useTab`（Tab キーで移動、`aria-current`、各パネルに見えない見出しを自動挿入）と `useTabAria`（APG の矢印キー方式、`aria-selected`、ロービング `tabindex`、`activation: auto|manual`）の 2 種類。位置は top / bottom / left / right。選択中は 6px バー＋太字、各タブ `p-4 text-dns-16N-120`、非選択のホバーは `bg-solid-gray-50`＋下線。
- LCI: エディタのファイルタブとレビューのペイン切替は `useTabAria`（activation auto）方式。高さ 32、`px-3`、ファイル名は `mono-13N-150`、選択中は下辺 2px の `accent` バーと `text-fg`、非選択は `text-fg-muted`（太字にしない）。`Cmd+Alt+←/→` は既存のまま、`role=tablist` には `aria-label="ファイル"` を付ける。

**NotificationBanner**
- DADS: type は `info1|info2|warning|error|success`、style は `standard`（枠 3px、角丸 12）と `color-chip`（左に内側の影 8 / 16px の色帯）。アイコンは `role="img"` と `aria-label`（インフォメーション / 警告 / エラー / 成功）。タイトルの見出しレベルは指定できる。閉じるボタンあり。**`role="status"` や `alert` は持たない**ので、利用側で付ける。
- LCI: 2 種類にする。①**compact**（1 行、高さ 32、`color-chip` 方式で左帯 4px、アイコン 16px、`dns-14N-130`）はセッション中の録画停止や保存失敗に使い、`role="status"`（失敗系だけ `alert`）を付け、自動では消さない。②**standard**（角丸 8、枠 1px の状態色、地は `*-subtle`）は S4 の評価失敗や preflight の注意に使う。文字はどちらも `--fg-body`（§3.3 のルール）。

**ChipLabel**
- DADS: variant は `text|outlined|filled-1|filled-2`、11 色、最小高さ 32、角丸 8、`oln-16N-100`。filled-1 は「50 段の地＋800〜1100 段の文字」。
- LCI: 高さ 20、`px-1.5`、角丸 4、`dns-13N-130`（ID は `mono-12N-120`）。用途は 4 つに限る。①カテゴリ（outlined、gray）、②難易度 L1–L4（text、gray、等幅）、③状態（filled-1 相当、success / warning / danger の `*-subtle` 地に状態色の文字。「実装あり / 言及のみ / なし」「AC / WA」）、④tier（`generated` だけ outlined で「自動生成」と出す）。色だけで区別せず、必ず文字を入れる。

**Table**（DADS は story だけでコンポーネントは無い）
- DADS: `<th scope="col|row">`、ヘッダ行は `border-b border-black bg-solid-gray-100`、行は `border-b border-solid-gray-420`、縞模様（`even:bg-solid-gray-50`）、ホバー `bg-key-50`、ソートは `<th aria-sort>` 内の `<button>`、セルは `px-4 py-5`（compact は `py-3`）、文字は `std-16N-170` か `dns-16N-130`。
- LCI: 問題一覧と履歴を `<table>` にする（現行は div で、ID が折り返している）。行 36、`px-3 py-2`、`dns-14N-130`。ID 列は `mono-13N-150` で `whitespace-nowrap`、数値は右揃えの tabular。ヘッダは `bg-canvas border-b border-border-strong`。縞模様は使わず、ホバーは `bg-hover`、`j/k` の選択行は `bg-selected` と左 2px の `accent`。行全体を 1 つのリンクにし、フォーカスは inset リングにする。ソートできる列は DADS と同じ `aria-sort`＋ボタン。

**Disclosure / Accordion**
- DADS: どちらも `<details><summary>` で、`::-webkit-details-marker` は隠す。Disclosure の summary は `w-fit`、ホバーで下線、フォーカス時は黄地。Accordion は `border-b gray-420`、`py-2`（desktop は `py-3.5`）、円形アイコン 20 / 32px が `group-open` で回転。
- LCI: 「評価の不確実性」「沈黙区間」「振り返り用解説」は Disclosure にする。16px のシェブロンで、回転の transition は使わない（向きは即時に切り替える）。summary は `dns-14B-130` で高さ 32 以上、`focus-text`。

**Breadcrumbs**
- DADS: `<nav>` の中に `<ol>`、区切り記号の SVG は `aria-hidden`、現在地は `aria-current="page"`（リンクにしない）、リンク色は `blue-1000`、押下時は `orange-800`。`nav` の `aria-label` は利用側で渡す。
- LCI: レビュー画面の「履歴 / 20261024T…」に使う。`aria-label="パンくずリスト"`、`dns-13N-130`、リンク色は `--fg-link`（押下時の orange は使わない）。現在地のセッション ID は `mono-12N-120` で省略表示し、`title` に全文を入れる。

**ProgressIndicator**
- DADS: `role="progressbar"`、`aria-valuemin/max/now`（値が無ければ indeterminate）、type は `stacked|inlined|stacked-underlay`、スピナーは lg 48 / sm 24、linear と static もある。`motion-reduce` でアニメーションを止める。`useProgressIndicatorAnnouncer` は開始・終了と 5 秒ごとに `role="status"` へ読み上げ文を入れる。
- LCI: S4 の評価待ちでは、各工程（mux → 文字起こし → 整合性 → Claude）を static の行として並べ、現在の工程だけ inlined の sm スピナーにする。再評価ボタンの中のスピナーも同じものに置き換える。読み上げは開始・完了・失敗だけにし、5 秒間隔の読み上げは切る（ローカルの作業なので冗長）。

**Dl**
- DADS: `grid gap-y-2`、`dt` は太字、`dd` は `ml-8`、`marker="bullet"` を指定できる。
- LCI: セッションのメタ情報と指標の補足に使う。compact の 2 列 grid（`grid-cols-[auto_1fr] gap-x-4 gap-y-1`）、`dt` は `dns-13N-130 text-fg-muted`（太字にしない）、`dd` は `dns-14N-130`（数値は tabular）。MetricsSummary のタイルは「`dt` ラベル＋`dd` 数値（`oln-24B-100`）」で組む。

**今回は採用しないもの**: HamburgerMenu、LanguageSelector、Carousel、EmergencyBanner、DatePicker（いずれも用途が無い）。ModalDialog は終了確認に使う（`<dialog>` ネイティブで、DADS のものを `--bg-raised` と `shadow-3` で再配色。別ドキュメントで扱う）。

---

## 6. フォント: ローカル配信かシステムフォントか

**結論: v1 はシステムフォントにする。Noto Sans JP も JetBrains Mono も同梱しない。**

| 観点 | 判断材料 |
|---|---|
| 実行環境 | LCI は「Mac 上でひとりで」使うローカルアプリ（CLAUDE.md）。macOS にはヒラギノ角ゴシック（`Hiragino Sans`、W3=400 / W6=700）が標準で入っている。DADS が Noto Sans JP を指定する主な理由はプラットフォーム間で見た目をそろえることで（要確認: 公式サイトの理由説明）、単一 OS のアプリでは効かない |
| `next/font/google` | ビルド時と dev 時にフォントを取得して自己ホストする。**ネットに繋がっていない状態で `next dev` / `next build` すると取得に失敗する**（失敗時の挙動とフォールバックは Next 16 で要確認）。オフラインを前提にするなら避ける |
| `next/font/local` | woff2 をリポジトリに置けばオフラインで動く。Noto Sans JP も JetBrains Mono も SIL OFL 1.1 で、アプリへの同梱と再配布は可能（要確認: 同梱版の LICENSE 表記）。ただし日本語フォントは 1 ウェイトで数 MB あり（要確認: サブセット版の実サイズ）、unicode-range の分割は自前で用意する必要がある（要確認） |
| Monaco との相性 | Monaco は初期化時に等幅の文字幅を計測する。Web フォントが遅れて読み込まれるとカーソルや選択範囲がずれる（`document.fonts.ready` の後に `monaco.editor.remeasureFonts()` が必要）。**システムの等幅フォントならこの問題が起きない** |
| 画面収録 | 録画も再生も同じ Mac で行うので、見た目の再現性はシステムフォントで十分 |
| 行間 | DADS の行間（1.3 / 1.5 / 1.7）は Noto を前提に決めた値だが、ヒラギノも縦方向の寸法は近い（要確認: 実測）。値はそのまま使う |

```css
--font-sans: system-ui, -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, "Noto Sans Mono", monospace;
```
- `<html lang="ja">` はすでにある。`system-ui` は日本語の字形をヒラギノで描く（Chrome / Safari、要確認: Chromium の最新挙動）。Monaco の `fontFamily` も `--font-mono` と同じ並びにする。`ui-monospace` は Safari 以外では効かないことがあるので、Menlo を明示している（要確認）。
- 将来 Noto に統一したくなった場合（Linux で開発するなど）の手順: `next/font/local` で Noto Sans JP の 400 / 700 サブセットを `apps/web/src/fonts/` に置き、`display: "swap"` は使わずに `"block"`（または `adjustFontFallback`）にして、セッション開始前にフォントの読み込みを待つ。04 §7.1 の「JetBrains Mono 相当（要確認: ライセンス）」については、OFL なので同梱自体はできる。ただ上記の理由で v1 では入れない、と回答する。

---

## 付録: 再現手順
- `node critique/scripts/contrast.mjs`（現行値と候補の総当たり、DADS の参照値）、`node critique/scripts/final.mjs`（§3.3 の表）。
- `node <dataviz>/scripts/validate_palette.js "#3460fb,#fb5b01,#8843e1,#00a3bf,#db00db" --mode light --surface "#ffffff"`、ダークは `"#4979f5,#e25100,#a565f8,#00a3bf,#db00db" --mode dark --surface "#1a1a1a"`、sequential は `--ordinal`。
