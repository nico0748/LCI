import { useId, type ReactNode } from "react";
import { cx } from "./cx.ts";

/** Field が子のコントロールに渡す属性 */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
};

export type FieldProps = {
  label: ReactNode;
  /** 入力の前に読む補足（形式・例）。ラベルの直下に出す */
  hint?: ReactNode;
  /** エラー文。あるときは aria-invalid を付け、hint より先に読み上げる */
  error?: ReactNode;
  required?: boolean;
  /** ラベルを視覚的に隠す（検索欄など、見た目で役割が明らかなときだけ） */
  labelHidden?: boolean;
  id?: string;
  className?: string;
  /** コントロールを描く関数。受け取った属性をそのまま Input / Select / Textarea に渡す */
  children: (control: FieldControlProps) => ReactNode;
};

/**
 * ラベル・補足・エラーの組。DADS の `Label` + `SupportText` + `ErrorText` を 1 つにまとめた LCI 版。
 * aria-describedby に「エラー → 補足」の順で id を並べ、エラーがあれば aria-invalid を付ける。
 * エラー文は DADS ErrorText と同じく、色だけに頼らず「▲」と文言で示す（role=alert は付けない:
 * 送信時にまとめて伝えるのは画面側の役目。入力のたびに読み上げると煩いため）。
 *
 * 例: <Field label="言語" hint="参照解がある言語だけ">{(p) => <Select {...p}>…</Select>}</Field>
 */
export function Field({ label, hint, error, required, labelHidden, id, className, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={controlId} className={cx("text-dns-14B-130 text-fg", labelHidden && "sr-only")}>
        {label}
        {required && <span className="ml-1.5 text-dns-13N-130 font-normal text-danger">必須</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-dns-13N-130 text-fg-muted">
          {hint}
        </p>
      )}
      {children({
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
}

/** DADS `ErrorText`。Field の外で使うとき（フォーム全体のエラーなど）も同じ見た目にする */
export function ErrorText({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} className={cx("flex items-start gap-1 text-dns-14N-130 text-danger", className)}>
      <span aria-hidden="true">▲</span>
      <span>{children}</span>
    </p>
  );
}
