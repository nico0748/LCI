"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  ChoiceGroup,
  Dialog,
  Disclosure,
  Dl,
  EmptyState,
  EvalChip,
  EvalMark,
  Field,
  FilterChip,
  IconButton,
  Input,
  Kbd,
  LinkButton,
  LoadingText,
  NotificationBanner,
  PageHeader,
  Radio,
  SearchBox,
  Section,
  Select,
  StatusBadge,
  Switch,
  TBody,
  THead,
  Table,
  TableScroll,
  Tabs,
  Td,
  Textarea,
  Th,
  Tr,
  tableRowLinkClass,
  type ButtonSize,
  type ButtonVariant,
  type EvalLevel,
} from "@/components/ui";
import { LCI_TOKENS, type SemanticToken, type ThemeMode } from "@/lib/theme/tokens.ts";
import { contrastRatio, formatRatio } from "@/lib/theme/contrast.ts";

type SwatchKind = "text" | "bg" | "ui";
type SwatchGroup = { title: string; kind: SwatchKind; tokens: SemanticToken[] };

const GROUPS: SwatchGroup[] = [
  { title: "面", kind: "bg", tokens: ["bg-canvas", "bg-surface", "bg-raised", "bg-sunken", "bg-hover", "bg-selected", "bg-hl-line", "bg-disabled", "bg-inverse"] },
  { title: "文字", kind: "text", tokens: ["fg", "fg-body", "fg-muted", "fg-link", "fg-disabled"] },
  { title: "境界", kind: "ui", tokens: ["border-subtle", "border", "border-strong", "border-input"] },
  { title: "アクセント", kind: "ui", tokens: ["accent", "accent-hover", "accent-active", "fg-on-accent"] },
  { title: "システム状態（X2）", kind: "text", tokens: ["success", "warning", "danger", "info", "rec"] },
  { title: "状態の地", kind: "bg", tokens: ["success-subtle", "warning-subtle", "danger-subtle", "info-subtle"] },
  { title: "評価: マーク（X1、3:1）", kind: "ui", tokens: ["eval-major", "eval-minor", "eval-good"] },
  { title: "評価: 文字（4.5:1）", kind: "text", tokens: ["eval-major-fg", "eval-minor-fg", "eval-good-fg"] },
  { title: "評価: 地", kind: "bg", tokens: ["eval-major-subtle", "eval-minor-subtle", "eval-good-subtle"] },
  { title: "可視化 categorical", kind: "ui", tokens: ["viz-1", "viz-2", "viz-3", "viz-4", "viz-5", "viz-neutral"] },
  { title: "可視化 sequential", kind: "ui", tokens: ["viz-seq-1", "viz-seq-2", "viz-seq-3", "viz-seq-4"] },
  { title: "フォーカス", kind: "ui", tokens: ["focus-outer", "focus-inner"] },
];

const TYPE_SCALE: Array<{ cls: string; use: string; sample?: string }> = [
  { cls: "text-std-24B-150", use: "ページ見出し（h1）" },
  { cls: "text-std-20B-150", use: "セクション見出し" },
  { cls: "text-dns-16B-130", use: "パネル見出し" },
  { cls: "text-dns-14B-130", use: "ペイン見出し・ラベル" },
  { cls: "text-std-16N-170", use: "本文（ページ）" },
  { cls: "text-std-14N-170", use: "本文（ペイン）★" },
  { cls: "text-dns-14N-130", use: "UI・表のセル" },
  { cls: "text-dns-13N-130", use: "キャプション ★（日本語の最小）" },
  { cls: "text-oln-16B-100", use: "ボタン md" },
  { cls: "text-oln-14B-100", use: "ボタン sm / xs" },
  { cls: "text-oln-24B-100", use: "指標の数値 ★", sample: "12:34  87%" },
  { cls: "text-mono-14N-150", use: "コード", sample: "const x = solve(n);" },
  { cls: "text-mono-13N-150", use: "ID・インラインコード ★", sample: "fe-0001  20261024T1200" },
  { cls: "text-mono-12N-120", use: "時刻・軸目盛 ★（全体の最小）", sample: "00:00  01:30  03:20" },
  { cls: "text-mono-16B-100", use: "タイマー ★", sample: "残り 19 分  4:59" },
];

/** 既定の比較相手では意味が無いトークンは、実際に組み合わせる相手との比を出す */
const PAIRED_WITH: Partial<Record<SemanticToken, [SemanticToken, string]>> = {
  "bg-inverse": ["fg-inverse", "fg-inverse"],
  "fg-on-accent": ["accent", "accent"],
  "focus-inner": ["focus-outer", "focus-outer"],
};

function Swatch({ token, kind, mode }: { token: SemanticToken; kind: SwatchKind; mode: ThemeMode }) {
  const t = LCI_TOKENS[mode];
  const hex = t[token];
  const paired = PAIRED_WITH[token];
  const ratios = paired
    ? [`${paired[1]} ${formatRatio(contrastRatio(hex, t[paired[0]]))}`]
    : kind === "text"
      ? [`surface ${formatRatio(contrastRatio(hex, t["bg-surface"]))}`, `canvas ${formatRatio(contrastRatio(hex, t["bg-canvas"]))}`]
      : kind === "bg"
        ? [`fg-body ${formatRatio(contrastRatio(t["fg-body"], hex))}`]
        : [`surface ${formatRatio(contrastRatio(hex, t["bg-surface"]))}`];
  return (
    <li className="flex items-center gap-2 min-w-0">
      <span aria-hidden="true" className="size-8 shrink-0 rounded-6 border border-border" style={{ background: `var(--${token})` }} />
      <span className="flex min-w-0 flex-col">
        <code className="text-mono-12N-120 text-fg truncate">--{token}</code>
        <span className="text-mono-12N-120 text-fg-muted">
          {hex} · {ratios.join(" / ")}
        </span>
      </span>
    </li>
  );
}

function Demo({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <Section title={title} size="panel" headingLevel={3} description={note} className="rounded-8 border border-border bg-surface p-4">
      {children}
    </Section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="w-28 shrink-0 text-dns-13N-130 text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

const PlusIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const focusPreview: CSSProperties = {
  outline: "var(--focus-width) solid var(--focus-outer)",
  outlineOffset: 2,
  boxShadow: "0 0 0 2px var(--focus-inner)",
};

export function Showcase({ mode }: { mode: ThemeMode }) {
  const [query, setQuery] = useState("two sum");
  const [emptyQuery, setEmptyQuery] = useState("");
  const [switchOn, setSwitchOn] = useState(true);
  const [switchOff, setSwitchOff] = useState(false);
  const [filters, setFilters] = useState({ fe: true, be: false, algo: false });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [sort, setSort] = useState<"ascending" | "descending">("descending");
  const variants: ButtonVariant[] = ["primary", "secondary", "tertiary", "danger", "danger-outline"];
  const sizes: ButtonSize[] = ["md", "sm", "xs", "2xs"];
  const levels: EvalLevel[] = ["major", "minor", "good"];

  return (
    <div className="flex flex-col gap-6">
      <Section title="色トークン" description="数値は WCAG 2.x のコントラスト比（文字は surface / canvas、面は fg-body を載せたとき、UI は surface に対して）">
        <div className="grid gap-4 desktop:grid-cols-2">
          {GROUPS.map((g) => (
            <Card key={g.title} padding="sm">
              <h3 className="mb-2 text-dns-14B-130 text-fg">{g.title}</h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.tokens.map((tok) => (
                  <Swatch key={tok} token={tok} kind={g.kind} mode={mode} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="タイポグラフィ" description="DADS 命名 text-{用途}-{size}{N|B}-{行間×100}。★ は LCI の拡張">
        <Card>
          <ul className="flex flex-col divide-y divide-border-subtle">
            {TYPE_SCALE.map((s) => (
              <li key={s.cls} className="grid gap-1 py-2 desktop:grid-cols-[240px_1fr] desktop:items-baseline">
                <span className="text-mono-12N-120 text-fg-muted">
                  {s.cls}
                  <br />
                  <span className="text-dns-13N-130">{s.use}</span>
                </span>
                <span className={`${s.cls} text-fg`}>{s.sample ?? "説明しながら書く練習 Aa 0123"}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title="部品">
        <div className="grid gap-4 desktop:grid-cols-2">
          <Demo title="Button" note="primary は 1 画面に 1 個。hover で下線は tertiary だけ">
            <div className="flex flex-col gap-3">
              {variants.map((v) => (
                <Row key={v} label={v}>
                  {sizes.map((s) => (
                    <Button key={s} variant={v} size={s}>
                      {s === "md" ? "開始する" : s === "sm" ? "評価を依頼" : s === "xs" ? "実行" : "削除"}
                    </Button>
                  ))}
                  <Button variant={v} disabled>
                    無効
                  </Button>
                </Row>
              ))}
              <Row label="kbd / loading">
                <Button variant="secondary" size="xs" kbd="⌘↵" keyshortcuts="Meta+Enter">
                  実行
                </Button>
                <Button variant="secondary" size="xs" loading kbd="⌘⇧↵">
                  判定
                </Button>
                <Button variant="primary" loading={false} icon={<PlusIcon />}>
                  追加
                </Button>
                <Button variant="primary" loading icon={<PlusIcon />}>
                  追加
                </Button>
              </Row>
              <Row label="IconButton">
                <IconButton label="追加" size="sm">
                  <PlusIcon />
                </IconButton>
                <IconButton label="追加" size="xs" variant="secondary">
                  <PlusIcon />
                </IconButton>
                <IconButton label="追加" size="2xs">
                  <PlusIcon />
                </IconButton>
                <IconButton label="ピン留め" pressed>
                  <PlusIcon />
                </IconButton>
                <IconButton label="追加" disabled>
                  <PlusIcon />
                </IconButton>
              </Row>
              <Row label="LinkButton">
                <LinkButton href="/problems" variant="primary" size="md">
                  問題を選ぶ
                </LinkButton>
                <LinkButton href="/sessions">履歴を見る</LinkButton>
                <LinkButton href="/" variant="tertiary">
                  ホームへ
                </LinkButton>
              </Row>
            </div>
          </Demo>

          <Demo title="Field / Input / Select / Textarea" note="ラベルは常に見せる。プレースホルダには例だけ">
            <div className="flex flex-col gap-4">
              <Field label="セッション名" hint="履歴の一覧に表示します">
                {(p) => <Input {...p} defaultValue="二分探索の練習" />}
              </Field>
              <Field label="制限時間（分）" required error="1 から 90 の整数で入力してください">
                {(p) => <Input {...p} defaultValue="120" inputMode="numeric" />}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="言語">
                  {(p) => (
                    <Select {...p} defaultValue="ts">
                      <option value="ts">TypeScript</option>
                      <option value="py">Python</option>
                    </Select>
                  )}
                </Field>
                <Field label="読み取り専用">{(p) => <Input {...p} readOnly defaultValue="fe-0001" />}</Field>
              </div>
              <Field label="無効">{(p) => <Input {...p} disabled defaultValue="実行環境なし" />}</Field>
              <Field label="標準入力" hint="サンプルの入力を編集できます">
                {(p) => <Textarea {...p} rows={3} className="font-mono" defaultValue={"3\n1 2 3"} />}
              </Field>
            </div>
          </Demo>

          <Demo title="SearchBox" note="送信ボタンなし（即時絞り込み）。値があるときだけ消去ボタン">
            <div className="flex flex-col gap-4">
              <SearchBox value={emptyQuery} onValueChange={setEmptyQuery} shortcutHint="/" placeholder="例: two-sum, debounce" hint="27 件" />
              <SearchBox value={query} onValueChange={setQuery} label="問題を検索" hint="3 件が一致" />
            </div>
          </Demo>

          <Demo title="Checkbox / Radio / Switch">
            <div className="flex flex-col gap-4">
              <ChoiceGroup legend="録画するもの" hint="カメラは任意です">
                <Checkbox defaultChecked>画面</Checkbox>
                <Checkbox defaultChecked hint="マイクが無いと発話の指標が出ません">
                  マイク
                </Checkbox>
                <Checkbox disabled>カメラ（未接続）</Checkbox>
                <Checkbox invalid>同意する</Checkbox>
              </ChoiceGroup>
              <ChoiceGroup legend="面接官" orientation="horizontal">
                <Radio name={`mode-${mode}`} defaultChecked>
                  フォローアップあり
                </Radio>
                <Radio name={`mode-${mode}`}>なし</Radio>
                <Radio name={`mode-${mode}`} disabled>
                  音声（準備中）
                </Radio>
              </ChoiceGroup>
              <div className="flex flex-col gap-2">
                <Switch checked={switchOn} onCheckedChange={setSwitchOn} hint="残り 1 分で 1 回だけ鳴らします">
                  チャイム
                </Switch>
                <Switch checked={switchOff} onCheckedChange={setSwitchOff}>
                  判定結果の件数を表示
                </Switch>
                <Switch checked={false} onCheckedChange={() => undefined} disabled>
                  ライブ字幕（未対応）
                </Switch>
              </div>
            </div>
          </Demo>

          <Demo title="Tabs / Disclosure" note="Tabs は矢印キーで移動（roving tabindex）。Disclosure はネイティブ details">
            <div className="flex flex-col gap-4">
              <Tabs
                label="ファイル"
                mono
                items={[
                  { id: "html", label: "index.html", panel: <p className="p-3 text-std-14N-170">index.html のパネル</p> },
                  { id: "js", label: "main.js", panel: <p className="p-3 text-std-14N-170">main.js のパネル</p> },
                  { id: "css", label: "style.css", panel: <p className="p-3 text-std-14N-170">style.css のパネル</p> },
                ]}
              />
              <Tabs
                label="表示"
                defaultSelectedId="transcript"
                items={[
                  { id: "code", label: "コード", panel: <p className="p-3 text-std-14N-170">コード</p> },
                  { id: "transcript", label: "文字起こし", panel: <p className="p-3 text-std-14N-170">文字起こし</p> },
                ]}
              />
              <Disclosure summary="評価の不確実性" meta="3 件">
                <p className="text-std-14N-170">文字起こしの信頼度が低い区間があります。</p>
              </Disclosure>
              <Disclosure summary="振り返り用の解説" open>
                <p className="text-std-14N-170">開いた状態。シェブロンは回転アニメーションなしで向きだけ変わります。</p>
              </Disclosure>
            </div>
          </Demo>

          <Demo title="NotificationBanner" note="danger は role=alert、それ以外は role=status。文字は fg-body">
            <div className="flex flex-col gap-3">
              <NotificationBanner tone="info" title="評価を作成しています" live="off">
                文字起こしが終わると Claude の評価を依頼します。
              </NotificationBanner>
              <NotificationBanner tone="success" title="保存しました" live="off" onClose={() => undefined} />
              <NotificationBanner
                tone="warning"
                title="マイクの許可がありません"
                live="off"
                actions={
                  <Button size="xs" variant="secondary">
                    もう一度確認
                  </Button>
                }
              >
                発話の指標が出せません。録画は画面だけで行います。
              </NotificationBanner>
              <NotificationBanner tone="danger" title="評価に失敗しました" live="off">
                API キーが設定されていません。
              </NotificationBanner>
              <NotificationBanner
                tone="danger"
                variant="compact"
                live="off"
                actions={
                  <Button size="xs" variant="secondary">
                    再接続
                  </Button>
                }
              >
                録画が止まっています（マイクが切断されました）。編集ログは記録を続けています。
              </NotificationBanner>
              <NotificationBanner tone="warning" variant="compact" live="off">
                残り 5 分です
              </NotificationBanner>
              <NotificationBanner tone="info" variant="compact" live="off">
                判定中…
              </NotificationBanner>
            </div>
          </Demo>

          <Demo title="StatusBadge（押せない） / FilterChip（押せる）" note="見た目が似ていても部品を分ける">
            <div className="flex flex-col gap-3">
              <Row label="filled">
                <StatusBadge tone="success">AC</StatusBadge>
                <StatusBadge tone="danger">WA</StatusBadge>
                <StatusBadge tone="warning">実行環境なし</StatusBadge>
                <StatusBadge tone="info">評価中</StatusBadge>
                <StatusBadge>下書き</StatusBadge>
              </Row>
              <Row label="outlined / text">
                <StatusBadge variant="outlined" mono>
                  FE
                </StatusBadge>
                <StatusBadge variant="outlined">自動生成</StatusBadge>
                <StatusBadge variant="text" mono>
                  L2
                </StatusBadge>
                <StatusBadge variant="outlined" tone="danger">
                  停止
                </StatusBadge>
              </Row>
              <Row label="FilterChip">
                <FilterChip pressed={filters.fe} onPressedChange={(v) => setFilters((f) => ({ ...f, fe: v }))} count={9}>
                  フロントエンド
                </FilterChip>
                <FilterChip pressed={filters.be} onPressedChange={(v) => setFilters((f) => ({ ...f, be: v }))} count={7}>
                  バックエンド
                </FilterChip>
                <FilterChip pressed={filters.algo} onPressedChange={(v) => setFilters((f) => ({ ...f, algo: v }))} count={11}>
                  アルゴリズム
                </FilterChip>
              </Row>
            </div>
          </Demo>

          <Demo title="EvalMark / EvalChip（X1）" note="評価は eval-*、図形＋文字を必ず併記。図形は surface の上だけ">
            <div className="flex flex-col gap-3">
              <Row label="マーク">
                {levels.map((l) => (
                  <EvalMark key={l} level={l} showLabel />
                ))}
                {levels.map((l) => (
                  <EvalMark key={`r-${l}`} level={l} kind="requirement" showLabel />
                ))}
              </Row>
              <Row label="図形のみ">
                {levels.map((l) => (
                  <EvalMark key={l} level={l} size={14} />
                ))}
                <span className="text-dns-13N-130 text-fg-muted">（sr-only で「重大」等を読む）</span>
              </Row>
              <Row label="チップ">
                {levels.map((l) => (
                  <EvalChip key={l} level={l} />
                ))}
                {levels.map((l) => (
                  <EvalChip key={`r-${l}`} level={l} kind="requirement" />
                ))}
                <EvalChip level="minor">② 改善 01:00</EvalChip>
              </Row>
            </div>
          </Demo>

          <Demo title="Kbd / Breadcrumbs">
            <div className="flex flex-col gap-3">
              <p className="flex flex-wrap items-center gap-2 text-dns-14N-130">
                実行 <Kbd>⌘↵</Kbd> 判定 <Kbd>⌘⇧↵</Kbd> 問題の開閉 <Kbd>⌘B</Kbd> 操作一覧 <Kbd>⌘/</Kbd>
              </p>
              <Breadcrumbs
                items={[
                  { label: "履歴", href: "/sessions" },
                  { label: "20261024T120000-fe-0001-abcdef", title: "20261024T120000-fe-0001-abcdef", mono: true },
                ]}
              />
            </div>
          </Demo>

          <Demo title="Table" note="行 36、sticky ヘッダ、選択行は selected＋左 2px accent、数値は右揃え tabular">
            <TableScroll maxHeight="220px">
              <Table caption="最近のセッション" captionHidden>
                <THead sticky>
                  <tr>
                    <Th>ID</Th>
                    <Th>問題</Th>
                    <Th numeric sort={sort} onSort={() => setSort((s) => (s === "ascending" ? "descending" : "ascending"))}>
                      時間
                    </Th>
                    <Th>状態</Th>
                  </tr>
                </THead>
                <TBody>
                  {[
                    ["fe-0001", "検索フォーム", "38:12", "AC"],
                    ["be-0003", "レート制限", "41:05", "WA"],
                    ["al-0007", "区間の併合", "22:40", "AC"],
                    ["fe-0004", "無限スクロール", "45:00", "AC"],
                    ["be-0001", "URL 短縮", "30:18", "WA"],
                  ].map(([id, title, time, st], i) => (
                    <Tr key={id} interactive selected={i === 1}>
                      <Td mono>
                        <a href="#table" className={tableRowLinkClass} aria-current={i === 1 ? "true" : undefined}>
                          {id}
                        </a>
                      </Td>
                      <Td>{title}</Td>
                      <Td numeric>{time}</Td>
                      <Td>
                        <StatusBadge tone={st === "AC" ? "success" : "danger"}>{st}</StatusBadge>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          </Demo>

          <Demo title="Dl / Card / EmptyState / LoadingText">
            <div className="flex flex-col gap-4">
              <Dl
                items={[
                  { term: "モデル", description: "claude-opus-5-5" },
                  { term: "所要", description: "38 分 12 秒", numeric: true },
                  { term: "ルーブリック", description: "v3（R3 15% / R8 5%）" },
                ]}
              />
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["発話率", "62%"],
                  ["最長沈黙", "140s"],
                  ["実行", "12"],
                ].map(([k, v]) => (
                  <Card key={k} padding="sm">
                    <Dl layout="stack" items={[{ term: k, description: <span className="text-oln-24B-100 text-fg">{v}</span> }]} />
                  </Card>
                ))}
              </div>
              <EmptyState title="まだセッションがありません" description="問題を選んで、最初の練習を始めましょう。" action={<LinkButton href="/problems" variant="primary">問題を選ぶ</LinkButton>} />
              <LoadingText />
            </div>
          </Demo>

          <Demo title="Dialog" note="開くと見出しにフォーカス。Esc で閉じる（dismissible=false では閉じない）">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setDialogOpen(true)}>終了確認を開く</Button>
                <Button onClick={() => setLockedOpen(true)}>保存中（閉じられない）</Button>
              </div>
              {/* スクリーンショット用の静的な見本（実物は上のボタンで開く） */}
              <div aria-hidden="true" className="rounded-12 border border-border bg-raised shadow-3">
                <div className="flex items-start gap-4 px-5 pt-5">
                  <p className="flex-1 text-std-20B-150 text-fg">セッションを終了しますか？</p>
                  <span className="text-dns-14N-130 text-fg-body">✕ 閉じる</span>
                </div>
                <p className="px-5 pt-3 text-std-14N-170">残り 7 分 12 秒あります。終了すると録画を保存し、振り返り画面へ移動します。</p>
                <div className="flex justify-end gap-2 p-5">
                  <span className="inline-flex min-h-8 items-center rounded-6 border border-border-input bg-surface px-3 text-oln-14B-100">続ける</span>
                  <span className="inline-flex min-h-8 items-center rounded-6 bg-danger px-3 text-oln-14B-100 text-on-danger">終了して保存</span>
                </div>
              </div>
              <Dialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title="セッションを終了しますか？"
                actions={
                  <>
                    <Button onClick={() => setDialogOpen(false)}>続ける</Button>
                    <Button variant="danger" onClick={() => setDialogOpen(false)}>
                      終了して保存
                    </Button>
                  </>
                }
              >
                <p>残り 7 分 12 秒あります。終了すると録画を保存し、振り返り画面へ移動します。</p>
                <p>終了したセッションは再開できません。</p>
              </Dialog>
              <Dialog
                open={lockedOpen}
                onOpenChange={setLockedOpen}
                dismissible={false}
                title="保存しています"
                actions={<Button onClick={() => setLockedOpen(false)}>（見本）閉じる</Button>}
              >
                <p>録画と記録を保存しています…（閉じないでください）</p>
              </Dialog>
            </div>
          </Demo>

          <Demo title="フォーカス（X6）" note="静的な見本。通常は DADS の二重リング、[data-session] 内は 2px の accent 単色">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col items-start gap-2">
                <span className="text-dns-13N-130 text-fg-muted">通常</span>
                <span className="inline-flex min-h-8 items-center rounded-6 border border-border-input bg-surface px-3 text-oln-14B-100" style={focusPreview}>
                  評価を依頼
                </span>
              </div>
              <div data-session="" className="flex flex-col items-start gap-2 rounded-8 bg-canvas p-3">
                <span className="text-dns-13N-130 text-fg-muted">面接画面</span>
                <span className="inline-flex min-h-7 items-center rounded-4 border border-border-input bg-surface px-2 text-oln-14B-100" style={focusPreview}>
                  実行
                </span>
              </div>
              <div className="flex flex-col items-start gap-2">
                <span className="text-dns-13N-130 text-fg-muted">テキスト（focus-text）</span>
                <span className="rounded-4 px-0.5 text-dns-14N-130" style={{ ...focusPreview, background: "var(--focus-text-bg)", color: "var(--focus-text-fg)" }}>
                  振り返りを開く
                </span>
              </div>
            </div>
          </Demo>

          <Demo title="可視化の色" note="必ず surface の上に描く。categorical は固定順、sequential は少→多">
            <div className="flex flex-col gap-3">
              <div className="flex items-end gap-2" aria-hidden="true">
                {[5, 4, 3, 4.5, 2].map((h, i) => (
                  <span key={i} className="w-8 rounded-t-4" style={{ height: h * 12, background: `var(--viz-${i + 1})` }} />
                ))}
                <span className="w-8 rounded-t-4" style={{ height: 18, background: "var(--viz-neutral)" }} />
              </div>
              <div className="flex items-center gap-1 text-dns-13N-130 text-fg-muted">
                編集量 少
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} aria-hidden="true" className="h-3 w-6" style={{ background: `var(--viz-seq-${i})` }} />
                ))}
                多
              </div>
            </div>
          </Demo>
        </div>
      </Section>

      <Section title="PageHeader の見本" size="panel">
        <Card>
          <PageHeader
            title="問題"
            description="27 問。カテゴリと難易度で絞り込めます。"
            breadcrumbs={<Breadcrumbs items={[{ label: "ホーム", href: "/" }, { label: "問題" }]} />}
            actions={<Button variant="primary">ランダムに選ぶ</Button>}
            meta={
              <>
                <StatusBadge variant="outlined" mono>
                  FE
                </StatusBadge>
                <span>更新 2026-10-24</span>
              </>
            }
          />
        </Card>
      </Section>
    </div>
  );
}
