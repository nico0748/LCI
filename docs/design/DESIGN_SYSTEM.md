# LCI デザインシステム（実装仕様）

実装済みの基盤の仕様。決定の経緯は `00_decisions.md`（X1–X13）と `critique/01_foundation.md`。食い違ったら **コードとこの文書が正**（値を変えたらこの文書も直す）。
見本は `/design`（ライトとダークを並べて全部品・全状態を表示。フッタの「デザインシステム」からだけ辿れる）。

## 1. ファイル構成

| 場所 | 中身 |
|---|---|
| `apps/web/src/app/globals.css` | primitive（`--dads-*` / `--lci-gray-*`）、semantic（light / dark）、移行用の別名、`@theme inline`、タイポの `@utility`、フォーカス、モーション、強制カラー |
| `src/lib/theme/tokens.ts` | semantic の解決済み hex（`LCI_TOKENS.light/dark`）と `PRIMITIVES`、`FONT_MONO`。Monaco・SVG 書き出し用の静的な写し |
| `src/lib/theme/pairs.ts` | コントラストを保証する組み合わせの一覧（113 組 × 2 モード） |
| `src/lib/theme/theme.ts` | テーマ設定（自動 / ライト / ダーク）の解決・保存・購読、描画前の初期化スクリプト |
| `src/lib/monaco-theme.ts` | `lci-light` / `lci-dark`、`useMonacoTheme()`、`LCI_MONACO_OPTIONS`（`src/lib/monaco.ts` から再エクスポート） |
| `src/components/ui/*` | 部品（`@/components/ui` から import） |
| `src/components/layout/*` | `AppHeader` / `AppFooter` / `ThemeSwitch` / `PageContainer` |
| `apps/web/scripts/check-contrast.mjs` | `pnpm --filter @lci/web check:contrast`（`--all` で全行） |

検査: `tokens.test.ts` が globals.css を解析して `LCI_TOKENS` / `PRIMITIVES` / `FONT_MONO` との一致、dark の 2 定義（`@media` と `[data-theme="dark"]`）の一致、未使用 primitive が無いこと、全ペアの基準達成を確かめる。

## 2. 色トークン

dark は `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` と `:root[data-theme="dark"], [data-theme="dark"]` の両方に同じ値を書く。`[data-theme]` は `<html>` 以外にも付けられる（/design の並列表示）。画面のコードは semantic だけを使い、primitive を直接参照しない。

| トークン | Light | Dark | 用途 |
|---|---|---|---|
| `--bg-canvas` | #f2f2f2 gray-50 | #121212 lci-940 | アプリの地 |
| `--bg-surface` | #ffffff | #1a1a1a gray-900 | ペイン・カード・表・**グラフの描画面** |
| `--bg-raised` | #ffffff | #242424 lci-860 | ダイアログ・ポップオーバー |
| `--bg-sunken` | #f2f2f2 | #0d0d0d lci-960 | コードブロック |
| `--bg-hover` | #f2f2f2 | #2e2e2e lci-820 | 行・項目のホバー |
| `--bg-selected` | #e8f1fe blue-50 | #222b41（blue-500 18% + gray-900） | 選択行・現在のタブ面・info の地 |
| `--bg-hl-line` | #ebeffc（accent 8%） | #262b39（accent 14%） | コードのハイライト行（黄を使わない、X3） |
| `--bg-disabled` | #e6e6e6 | #2e2e2e | 無効な塗りボタン・入力欄 |
| `--bg-inverse` / `--fg-inverse` | #1a1a1a / #f2f2f2 | #f2f2f2 / #1a1a1a | ツールチップ・再生ヘッドの時刻 |
| `--fg` | #1a1a1a | #f2f2f2 | 見出し・強調 |
| `--fg-body` | #333333 | #e6e6e6 | 本文。状態色の地（`*-subtle`）の上の文字はこれ以上 |
| `--fg-muted` | #666666 | #b3b3b3 | 補足・ラベル。**AA を満たす最も淡い文字** |
| `--fg-disabled` | #949494 | #666666 | 無効（3:1 は確保） |
| `--fg-link` | #0017c1 | #9db7f9 | リンク・tertiary ボタン |
| `--fg-on-accent` / `--fg-on-danger` | #fff / #fff | #000060 / #000 | 塗りボタンの文字 |
| `--border-subtle` / `--border` | #e6e6e6 / #cccccc | #262626 / #333333 | 装飾の区切り / ペイン・カードの枠（1.4.11 対象外） |
| `--border-strong` | #767676 gray-536 | #767676 | 意味を持つ境界（表ヘッダの下線、outlined チップ） |
| `--border-input` | #666666 | #999999 | 入力欄・secondary ボタン |
| `--accent` / `-hover` / `-active` | #0031d8 / #0017c1 / #00118f | #7096f8 / #9db7f9 / #c5d7fb | 主ボタン・選択インジケータ・再生ヘッド |
| `--success` / `-subtle` | #197a4b / #e6f5ec | #71c598 / #08351f | AC・保存成功 |
| `--warning` / `-subtle` | #806300 / #fbf5e0 | #ffd43d / #604b00 | 注意・残り 5 分 |
| `--danger` / `-subtle` / `-hover` | #ce0000 / #fdeeee / #a90000 | #ff7171 / #620000 / #ff9696 | 失敗・削除・WA |
| `--info` / `-subtle` | = accent / = bg-selected | 同左 | 情報バナー |
| `--rec` | #ec0000 | #ff5454 | 録画中の点（非テキスト） |
| `--eval-major` / `-fg` / `-subtle` | #ce0000 / #a90000 / #fdeeee | #fe3939 / #ff9696 / #3e1f1f | 評価: 重大・未実装 ▲ |
| `--eval-minor` / `-fg` / `-subtle` | #b78f00 / #6e5600 / #fbf5e0 | #d2a400 / #ffd43d / #373016 | 評価: 改善・言及のみ ◆ |
| `--eval-good` / `-fg` / `-subtle` | #008da6 / #006173 / #e9f7f9 | #00a3bf / #79e2f2 / #163034 | 評価: 良い・実装あり ●✓ |
| `--viz-1…5` | #3460fb #fb5b01 #8843e1 #00a3bf #db00db | #4979f5 #e25100 #a565f8 #00a3bf #db00db | categorical（固定順） |
| `--viz-seq-1…4` | #4979f5 #264af4 #0017c1 #000071 | #3460fb #7096f8 #9db7f9 #d9e6ff | 編集量（少→多） |
| `--viz-neutral` | #949494 | #767676 | 沈黙・停滞・その他 |
| `--focus-outer` / `--focus-inner` | #000 / #ffd43d | #ffd43d / #000 | フォーカスの外側 4px / 内側 2px |

その他: `--elevation-1`（メニュー）/`--elevation-3`（ダイアログ）、`--bg-backdrop`、`--focus-text-bg/-fg`、`--focus-width`、`--duration-fast: 120ms`、`--ease-standard`。dark の `eval-*-subtle` は「mark 16% + surface」を sRGB で混ぜた固定値。

**Tailwind での名前**（`@theme inline`）: `bg-canvas` `bg-surface` `bg-raised` `bg-sunken` `bg-hover` `bg-selected` `bg-hl-line` `bg-disabled` `bg-inverse`、`text-fg` `text-fg-body` `text-fg-muted` `text-fg-disabled` `text-link` `text-on-accent` `text-on-danger` `text-fg-inverse`、`border-border-subtle` `border-border` `border-border-strong` `border-border-input`、`bg-accent` `bg-accent-hover` `bg-accent-active`、`text-success` `bg-success-subtle`（warning / danger / info も同形）、`bg-danger-hover`、`bg-rec`、`text-eval-major` `text-eval-major-fg` `bg-eval-major-subtle`（minor / good も同形）、`bg-viz-1` `fill-viz-seq-2` `bg-viz-neutral`、`outline-focus-outer`、`shadow-1` `shadow-3`、`rounded-4/6/8/12`、ブレークポイント `desktop:`（48rem）。不透明度は `bg-eval-major/10` のように付けられる（評価の選択 wash）。

**移行用の別名**（画面の移行が終わったら消す）: `--bg`→canvas、`--bg-elev`→surface、`--accent-fg`→fg-on-accent、`--warn`→warning、`--ok`→success。ユーティリティ `bg-bg` `bg-bg-elev` `text-warn` `text-ok` `text-accent-fg` も当面動く。**新しいコードでは使わない**。Tailwind 標準の色（`bg-white` `text-red-500`）、文字サイズ（`text-xs` `text-sm`）、`rounded-md` なども新規には使わない（移行の終盤に `@theme` で封じる）。

## 3. タイポグラフィ

方式は DADS v4.css と同じ `@utility`（`text-{用途}-{size}{N|B}-{行間×100}`）。1 クラスで size / weight / line-height / letter-spacing を決める。★ は LCI の拡張。`mono-*` は DADS と違い font-family と tabular-nums まで含む。

| クラス | 値 | 使う場所 |
|---|---|---|
| `text-std-24B-150` | 24 / 1.5 / .02em / 700 | ページ見出し（h1） |
| `text-std-20B-150` | 20 / 1.5 / .02em / 700 | セクション見出し、ダイアログ見出し |
| `text-std-16N-170` / `16B-170` | 16 / 1.7 / .02em | 本文（ページ単位：ホーム・総評・事前確認） |
| `text-std-14N-170` ★ | 14 / 1.7 / .02em | 本文（ペイン：問題文・文字起こし・フィードバック） |
| `text-dns-16B-130` / `16N-130` | 16 / 1.3 / 0 | パネル見出し |
| `text-dns-14B-130` / `14N-130` | 14 / 1.3 / 0 | ペイン見出し・ラベル / UI・表のセル |
| `text-dns-13N-130` ★ | 13 / 1.3 / 0 | キャプション・チップ。**日本語の最小** |
| `text-oln-16B-100` / `14B-100` / `14N-100` | 16・14 / 1.0 / .02em | ボタン（md / sm・xs） |
| `text-oln-24B-100` ★ | 24 / 1.0 / 700 + tabular | 指標の数値 |
| `text-mono-14N-150` / `13N-150` ★ | 14・13 / 1.5 | コード / ID・インラインコード |
| `text-mono-12N-120` ★ | 12 / 1.2 | 時刻・軸目盛。**数字とラテン文字専用で全体の最小** |
| `text-mono-16B-100` ★ | 16 / 1.0 / 700 | タイマー |

- 10px・11px と SVG の `fontSize 9/10` は使わない。グラフ内も日本語 13px・数字 12px 以上。
- 数値（時刻・件数・分・指標）は `tabular-nums`（Tailwind 標準のユーティリティ）。太字は 700 だけ。
- フォントはシステムフォント（Web フォントを同梱しない）: `--font-sans: system-ui, -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif` / `--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, "Noto Sans Mono", monospace`。

## 4. スペーシング・密度・角丸・影

- 4px 単位（Tailwind 標準の spacing）、レイアウトのリズムは 8px。
- コントロールの高さ: **md 36**（ページの主操作）/ **sm 32（既定）**（フィルタ・表の操作・ツールバー）/ **xs 28**（面接ヘッダ 40px 内）/ **2xs・icon 24**（行内。2.5.8 の下限、隣と 8px 以上離す）。入力欄は md 36 / sm 32。
- 面: グローバルヘッダ 56、面接ヘッダ 40、タブ 32、表の行 36、カードのパディング 16（sm 12）、カード間 12。
- `PageContainer`: 最大 1200（`width="reading"` は 720）、左右 16（desktop 24）、上下 24。
- 角丸: 4（xs・icon・チップ）/ 6（ボタン・入力）/ 8（カード・パネル・バナー）/ 12（ダイアログ）/ full（点・FilterChip）。16 以上は使わない。
- 影はオーバーレイだけ（`shadow-1` メニュー、`shadow-3` ダイアログ）。カードやペインは枠線と面の明度差で区切る。dark の影は 1px の枠を含む。

## 5. フォーカスとモーション

- **標準**（base の `:focus-visible`）: DADS の二重リング。内側 2px `--focus-inner`、外側 `--focus-width`(4px) `--focus-outer`、offset 2px。dark は黄と黒が入れ替わる。入力欄・select・textarea は `:focus` で出す（DADS と同じ）。Monaco 内部（`.monaco-editor *`）には当てない。
- 変種: `focus-ring-compact`（外側 2px）、`focus-ring-inset`（内側 3px：タブ・表の行・ナビ）、`focus-text`（黄地＋黒文字：テキストリンク・summary）。
- **面接画面**: 画面のルート要素に `data-session` を付けると、`--focus-outer: var(--accent)`、`--focus-inner: transparent`、`--focus-width: 2px`、`focus-text` の黄地なしに切り替わる（X6。録画に黄色い枠を映さない。accent は canvas / surface / raised で 3:1 以上）。`<html>` には付けない（テーマの指定より詳細度が低い）。
- モーション: セッション外で許すのは色・不透明度のフェード（`--duration-fast`）だけ。`prefers-reduced-motion: reduce` で全アニメーション・トランジションを実質 0 に。`[data-session] *` は `animation` / `transition` を `none !important`。スピナー・スケルトンは使わない（`LoadingText` と Button の `loading` の静止「…」）。
- 強制カラー: フォーカスは `Highlight`、`[aria-disabled=true]` は `GrayText`、`data-ui="button|chip|banner"` の要素は枠を必ず描く。

## 6. 部品カタログ（`import { … } from "@/components/ui"`）

| 部品 | DADS | 要点 |
|---|---|---|
| `Button` | Button | variant: `primary`（1 画面 1 個まで）/ `secondary`（既定・outline）/ `tertiary`（リンク色、hover で下線）/ `danger`（確認ダイアログ内だけ）/ `danger-outline`。size: `md` `sm` `xs` `2xs`。`disabled` は `aria-disabled`（フォーカスは残る、クリックは止める、透明度は使わない）。`loading` は静止「…」と `aria-busy`（一度でも渡せば幅固定）。`kbd="⌘↵"` + `keyshortcuts="Meta+Enter"`、`icon` |
| `IconButton` | Button | `label` 必須（aria-label と title）。size `sm` 32 / `xs` 28 / `2xs` 24。`pressed` でトグル |
| `LinkButton` | Button asChild | Next の `Link` をボタンの見た目に。遷移する操作だけ。`buttonClasses()` で他要素にも付けられる |
| `Field` + `Input` / `Textarea` / `Select` | Label・Input・Textarea・Select・ErrorText | `<Field label hint error required>{(p) => <Input {...p} />}</Field>`。`aria-describedby`（エラー→補足）と `aria-invalid` を配線。プレースホルダは例だけ。読み取り専用は破線。Select の矢印は currentColor の SVG |
| `Checkbox` / `Radio` / `ChoiceGroup` | Checkbox・Radio | ネイティブ input + `accent-color`。ラベル必須、`hint`、`invalid`、`disabled`（aria-disabled）。グループは fieldset/legend |
| `Switch` | SwitchOnOff | 即時に効く設定に（送信を待つ選択は Checkbox）。`role="switch"`、オンは ✓ を描く |
| `SearchBox` | SearchBox | 即時絞り込み、送信ボタンなし、値があるときだけ消去ボタン、Esc で消去、`shortcutHint="/"`、`hint` は aria-live の件数 |
| `Tabs` / `useTabs` | Tab（useTabAria） | 矢印・Home/End、roving tabindex、activation auto/manual。高さ 32、下辺 2px accent、太字にしない。パネル共有（エディタ）は `useTabs` と `tabClass` を直接使う（`text-dns-14N-130` か `text-mono-13N-150` を足す） |
| `Disclosure` | Disclosure | ネイティブ details。16px シェブロン、回転アニメなし、`meta` で件数 |
| `NotificationBanner` | NotificationBanner | tone `info/success/warning/danger`。`standard`（枠＋subtle 地＋見出し）/ `compact`（32px・左 4px 帯）。既定 role は danger=`alert`、他=`status`、`live="off"` で無し。図形 ⓘ✓！✕ ＋文字。自動で消さない |
| `StatusBadge`（別名 `Chip`） | ChipLabel | **押せない**状態表示。高さ 20、tone `neutral/info/success/warning/danger`、variant `filled/outlined/text`、`mono`。状態系はグリフを出す |
| `FilterChip` | （なし） | **押せる**絞り込み。`aria-pressed`、高さ 28、丸、選択中は ✓＋accent 枠＋selected 地、`count` |
| `EvalMark` / `EvalChip` / `EvalGlyph` | （なし） | 評価の 3 値（§8）。`level` `kind="feedback|requirement"`、`showLabel`。図形だけのときも sr-only で語を読む。`evalLevelOf(core の値)` |
| `Kbd` | （なし） | 等幅 12px の枠付き |
| `Dialog` | ModalDialog + useModalDialog | ネイティブ `showModal()`、開いたら見出しにフォーカス、Esc は cancel で処理、`dismissible={false}` で Esc と閉じるを無効、閉じたら元の要素へフォーカスを戻す。主操作は actions の最後 |
| `Breadcrumbs` | Breadcrumbs | nav + ol、区切りは aria-hidden、現在地は `aria-current="page"`、`mono` と `title` で ID を省略表示 |
| `TableScroll` `Table` `THead` `Tr` `Th` `Td` | Table（story） | 行 36、`THead sticky`、`Th sort onSort`（aria-sort＋button）、`Td numeric/mono`、`Tr interactive selected`（selected 地＋左 2px accent）。行リンクは `tableRowLinkClass`（::after で行全体、内側リング）、選択行のリンクに `aria-current="true"` |
| `Dl` | Dl | 2 列 grid（`layout="stack"` で縦）、dt 13px muted、dd 14px |
| `Card` / `Section` / `PageHeader` | （Card は不採用） | Card は枠＋surface、影なし。Section は `<section aria-labelledby>`＋見出し（size `section/panel/pane`）＋actions。PageHeader は h1＋説明＋meta＋actions＋breadcrumbs |
| `EmptyState` / `LoadingText` | （なし） | 何が無いか・次の操作を文で。読み込みは `role="status"` の静止文 |
| `AppHeader` / `AppFooter` / `ThemeSwitch` / `PageContainer` | — | layout 側。ヘッダは 56px、ナビ ホーム/問題/履歴（`aria-current`）、テーマ切替、スキップリンク（`#main-content`）。`/session/<id>` では描かない |

**使い分け**
- primary か secondary か: その画面で「次に進む」操作 1 つだけ primary（開始する、評価を依頼）。並ぶ操作・取り消し・補助は secondary、文中や軽い操作は tertiary。面接ヘッダには塗りボタンを置かない。
- StatusBadge か FilterChip か: 押して状態が変わるなら FilterChip、表示だけなら StatusBadge。見た目を寄せない（高さ・角丸・✓ で区別）。
- バナーかインラインか: 画面全体・処理全体に関わる結果（評価失敗、権限不足、録画停止）は NotificationBanner。1 つの入力の誤りは Field の error、1 行の状態（判定中・件数）はペイン内の静止テキスト。トースト・自動で消える通知は作らない。
- Dialog は取り返しのつかない操作の確認と、中断させたくない処理中表示だけ。

## 7. 面接画面（S3）の例外

- 画面のルートに `data-session` を付ける（フォーカス 2px accent、アニメーション・トランジション全停止）。
- グローバルヘッダ・フッタ・テーマ切替は出さない（`isInterviewRoute`）。テーマは開始時の値で固定し、セッション中に Monaco のテーマを切り替えない。
- ボタンは `size="xs"`（28px）の secondary / tertiary。終了は無彩色の tertiary（赤は録画停止だけ）。処理中は `loading`（静止「…」）。
- 通知は `NotificationBanner variant="compact"`（録画停止は danger、`role="alert"`）。判定結果は色を付けない静止テキスト。
- タイマー: `text-mono-16B-100`、残り 5 分から `text-warning`（X4）＋左 3px の縦線、`role="timer"`。
- 録画: 録画中 `● 録画中`（点は `bg-rec`、文字は `text-fg-muted`、点滅なし）、記録のみ `○`、停止は compact の danger バナー。

## 8. 評価色とシステム色（X1–X3）

- **X1 評価**（指摘の重大/改善/良い、要件の未実装/言及のみ/実装あり）は `--eval-*` だけを使う。必ず図形（▲ ◆ ●✓）と文字を併記する（`EvalMark` / `EvalChip`）。図形（`--eval-*`）は `--bg-surface` / `--bg-raised` の上にだけ描く（light の canvas 上で minor は 2.70:1）。文字は `--eval-*-fg`、チップの地は `--eval-*-subtle`、選択範囲の wash は `bg-eval-*/10`。
- **X2 システム状態**（実行結果 AC/WA/CE、Docker、保存、バナー）は `--success / --warning / --danger / --info`（`StatusBadge` / `NotificationBanner`）。図形は ✓ ！ ✕ ⓘ。評価の図形（▲◆●）と混ぜない。
- **X3 黄は「注意」専用**: `--warning` と `--eval-minor` 以外に黄を使わない。選択は `--bg-selected`、コードのハイライト行は `--bg-hl-line`、フェーズ表示は無彩色。
- 可視化: categorical は固定順で、**評価マークと同じグラフに置かない**（viz-4 の cyan は dark の eval-good と同値）。5 系列目（magenta）を使うときは直接ラベル必須（cyan と隣接で deutan ΔE 6.5）。sequential は 1 色相の 4 段（不透明度で濃淡を作らない）。グラフは必ず surface 上。

## 9. コントラスト（`check:contrast` の結果）

全 113 組 × 2 モードが基準を満たす。本文（4.5:1）の最小は light 4.69（`success` / `bg-selected`）、dark 4.78（`accent` / `bg-hover`）。UI（3:1）の最小は light 3.00（`viz-4`）、3.02（`eval-minor`）、dark 3.03（`fg-disabled`）。組み合わせを増やすときは `pairs.ts` に足してから使う。Monaco の行番号は light #767676（4.54）、dark #999999（6.11）。

## 10. Monaco

`loadMonacoReact()` が `lci-light` / `lci-dark` を登録してから返すので、`<Editor theme={...}>` にそのまま渡せる。`theme` は `useMonacoTheme()`（`data-theme` と OS 設定に追従。面接画面では開始時の値を固定する）。`beforeMount={defineLciThemes}` でも可。`options` には `LCI_MONACO_OPTIONS`（システム等幅、14px / 22、カーソル点滅なし、スムーズスクロールなし、細いスクロールバー）を展開する。構文色は vs / vs-dark を継承し、面（surface）・行番号・現在行・選択（accent 22% / 28%）・カーソルだけ LCI に合わせる。

## 11. DADS との差分

| 項目 | DADS | LCI |
|---|---|---|
| ダークモード | 無し | primitive から導出（`--lci-gray-*` を追加、有彩色は 200–500 段へ移す、選択は mix の固定値） |
| トークンの取り込み | v4.css を import | primitive を `--dads-*` に改名して写す。`@theme` には semantic だけ |
| 主色 | key-900 #0017c1 | blue-800 #0031d8（hover が 900） |
| 警告の文字 | yellow-900 | yellow-1000（canvas #f2f2f2 上で AA）。warning-orange は使わない |
| `--border-strong` | — | gray-536（01 案の gray-420 は canvas で 2.71 のため） |
| sequential | 規定なし | light blue-500/700/900/1100、dark blue-600/400/300/100（01・04 案の最淡段 2.7–2.8 を 3:1 以上へ） |
| 評価の 3 値 | success/error/warning | 赤・黄・シアン（04 案 A）＋図形＋文字 |
| ボタン寸法 | 48–56px、sm/xs に 44px 当たり判定 | 36/32/28/24、当たり判定の拡張なし |
| ボタンの hover | 全バリアントで下線 | 下線は tertiary・リンクだけ |
| 強制カラー対策 | 塗りボタンに 4px double border | 1px 透明枠＋`forced-colors:border-[ButtonText]` |
| Tab | 上辺 6px＋太字、p-4 | 下辺 2px、太字にしない、高さ 32 |
| NotificationBanner | 枠 3px・アイコン 36px・role なし | standard（枠 1px）と compact（32px）、role を付ける |
| ChipLabel | 高さ 32、角丸 8 | 高さ 20、角丸 4、13px。押せるチップは FilterChip に分離 |
| Checkbox / Radio | 独自描画 | ネイティブ＋accent-color |
| フォーカス | 二重リング固定 | 面接画面だけ 2px accent（X6） |
| ProgressIndicator | スピナー・linear | 使わない（静止テキスト） |
| 部品の共通化 | 禁止（コピー前提） | `cx` と `classes.ts` だけ共有（アプリ内ライブラリのため） |
| mono タイポ | font-family なし | font-family と tabular-nums を含む |
| フォント | Noto Sans JP / Noto Sans Mono | システムフォント |
