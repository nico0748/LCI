### 2026-06-26 ライブコーディング試験

- **形式**: 全体構成の方針を話しながらコードを書いていく試験。相手からの返答はなく、基本的にこちらから一方的に話し続けるスタイル。**制限時間20分**。
- **問題（検索フォーム）**:
  - `input` に検索ワードを入力して `button` を押すと API にリクエストを送る。送信形式は `https://api.example.com/search?q=〇〇`。
  - サーバーからは `Array<{ id: number, title: string }>` の JSON が返り、その内容を `div` に展開する。各要素には `title` を表示。
    ```json
    [
        { "id": 1, "title": "Lorem ipsum" },
        { "id": 2, "title": "Dolor" },
        { "id": 3, "title": "Sit amet" },
        { "id": 4, "title": "Consectetur adipiscing elit" }
    ]
    ```
  - クエリが空のときは `[]` が返る。
  - **サーバーがとても貧弱なので、極力サーバーに優しくなるよう処理を書く**こと。
  - **簡易的なキャッシュ戦略を説明しながら**コーディングする。
  - CSSを使う場合は TailwindCSS を埋め込み型で記述。
  - レイアウト: input + button が横並び、その下に div。
  - 備考: 表示ライブラリ（React/Vue/Angular/jQuery/生JS）・通信手段（axios/fetch/$.ajax/生XHR）は自由。メソッド名は多少違っても可。設問者に質問してOK。**Web検索は不可**。`class`/`id` は適当に補ってよい。import は省略可。
- **想定解答の方針（振り返り用）**:
  - サーバーへの不要リクエストを減らす設計を軸に宣言する: ①空クエリは送らない ②同一クエリはキャッシュから返す ③古いリクエストは `AbortController` で中断。
  - キャッシュは `Map<query, { data, ts }>` でクエリをキーに結果を保持。`ts`＋TTLで鮮度担保。発展で LRU（最大件数で古いものから破棄）に言及。
  - 入力中随時検索なら debounce が追加の有力策（今回はボタン起点なので必須ではない、と線引きできると要件理解が伝わる）。
  - 実装サンプル: 別途 `search-form.html`（生JS + fetch + Tailwind埋め込み）を作成済み。

