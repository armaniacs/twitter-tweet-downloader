# Go言語移行プラン (Twitter Tweet Downloader)

現在のPython実装（Selenium + undetected-chromedriver）をGo言語へ移植するための計画書です。

## 目的
- **シングルバイナリ化**: ユーザーへの配布を容易にする（Python環境構築不要）。
- **パフォーマンス**: 実行速度とリソース効率の向上。
- **型安全性**: 静的型付けによる堅牢な実装。

## 技術スタック選定

| カテゴリ | Python (現在) | Go (移行案) | 選定理由 |
| --- | --- | --- | --- |
| **ブラウザ操作** | `selenium`, `undetected-chromedriver` | **`chromedp`** | GoネイティブでChrome DevTools Protocol (CDP) を使用するため軽量・高速。外部WebDriver不要。 |
| **HTML解析** | `BeautifulSoup4` | **`go-query`** | jQueryライクな構文で使いやすく、BeautifulSoupからの移行が容易。 |
| **CLI引数処理** | `argparse` | **`flag`** (標準) or `cobra` | シンプルなツールなので標準の `flag` で十分だが、拡張性を考慮するなら `cobra`。今回は標準 `flag` で開始。 |
| **構造化データ** | `dataclass` | **`struct`** | Goの基本機能。 |

## アーキテクチャ設計

### ディレクトリ構成案
```
.
├── cmd/
│   └── tweet-downloader/
│       └── main.go      # エントリーポイント
├── internal/
│   ├── browser/         # chromedp ラッパー (起動、プロファイル管理)
│   ├── scraper/         # スクレイピングロジック
│   ├── models/          # Tweet 構造体など
│   └── output/          # Markdown出力処理
├── go.mod
├── go.sum
└── README.md
```

### 主要コンポーネントの移行方針

#### 1. ブラウザ起動と検出回避 (`internal/browser`)
**課題**: Pythonの `undetected-chromedriver` は強力なBot検出回避機能を持つが、Goの `chromedp` には同等の完全なパッケージがない可能性がある。
**対策**:
- `chromedp` の起動オプションで `User-Agent` や `navigator.webdriver` の隠蔽を行う。
- **重要**: 既存のChromeプロファイル（ユーザーデータディレクトリ）を指定して起動する機能を実装し、ログイン状態（Cookie）を維持することで、ログイン壁を回避する戦略を継続する。

#### 2. スクレイピングロジック (`internal/scraper`)
- **待機処理**: `time.Sleep` だけでなく、`chromedp.WaitVisible` などを活用して効率化する。
- **スクロール**: CDPを使ってJavaScript (`window.scrollTo`) を実行し、DOMの変化を検知する。
- **解析**: 取得したHTMLを `go-query` に渡してパースする。

#### 3. データ構造 (`internal/models`)
```go
type Tweet struct {
    Date     time.Time
    Text     string
    Username string
}

func (t *Tweet) ToMarkdown(execTime string) string {
    // Format: - [ExecTime] 【X】 [Date] [Text]
    return fmt.Sprintf("- %s 【X】 %s %s", execTime, t.Date.Format("01/02 15:04"), strings.ReplaceAll(t.Text, "\n", " "))
}
```

## 実装ステップ

1.  **プロジェクト初期化**: `go mod init`
2.  **ブラウザ制御の実装**:
    -   `chromedp` を導入。
    -   ヘッドレスモード/GUIモードの切り替え実装。
    -   ユーザーデータディレクトリ（プロファイル）の指定実装。
3.  **Twitter検索・スクロールの実装**:
    -   指定URLへの遷移。
    -   無限スクロールのハンドリング。
4.  **HTML解析の実装**:
    -   `article` タグの取得。
    -   日付、本文の抽出ロジック移植。
5.  **CLIと出力の実装**:
    -   フラグ解析。
    -   Markdownファイルへの書き出し。
6.  **検証**:
    -   Python版と同じ出力が得られるか確認。

## リスクと懸念事項

> [!WARNING]
> **Bot検出 (Anti-Bot) 対策**
> Pythonの `undetected-chromedriver` は非常に優秀です。Goの `chromedp` だけでは、Twitterの高度なBot検出に引っかかるリスクが高まる可能性があります。
> **緩和策**:
> - 開発中はヘッドレスモードを使わず (`headless=false`)、実際のブラウザ挙動に近づける。
> - ログイン済みのプロファイル利用を前提とする。

## 今後の拡張性
- 並行処理（Goroutines）を使った複数アカウントの同時取得（Pythonより容易に実装可能）。
