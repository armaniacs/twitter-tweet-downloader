# Twitter Tweet Downloader - 開発ガイド

このドキュメントは、Twitter Tweet Downloaderの開発を行う方向けのガイドです。

## プロジェクト構成

```
.
├── download_tweets.py    # メインスクリプト
├── README.md             # ユーザー向けドキュメント
├── DEVELOPMENT.md        # 開発者向けドキュメント（本ファイル）
├── chrome_profile/       # Chromeプロファイル保存先（実行時に自動生成）
└── tweets.md             # 出力ファイル（実行時に生成）
```

## アーキテクチャ

### 主要コンポーネント

1. **Tweet データクラス**
   - ツイートの情報を保持
   - `to_markdown()` メソッドでMarkdown形式に変換

2. **setup_driver()**
   - undetected-chromedriverを使用してブラウザを起動
   - プロファイルディレクトリを設定してログイン状態を保持

3. **parse_tweet_element()**
   - BeautifulSoupを使用してHTML要素からツイート情報を抽出
   - 日時はUTCからJST（UTC+9）に変換

4. **get_tweets()**
   - Twitter検索URLを構築してアクセス
   - スクロールしながらツイートを収集
   - 重複チェック（`seen_texts`）を実装

5. **main()**
   - コマンドライン引数の解析
   - 実行時刻の取得
   - ツイート取得とファイル出力

## 技術スタック

- **Python 3.x**: メイン言語
- **undetected-chromedriver**: Selenium検出回避
- **Selenium**: ブラウザ自動操作
- **BeautifulSoup4**: HTML解析
- **argparse**: コマンドライン引数解析

## 開発環境のセットアップ

```bash
# 依存ライブラリのインストール
pip install selenium webdriver-manager beautifulsoup4 undetected-chromedriver

# スクリプトの実行（テスト）
python3 download_tweets.py NASA 2023-01-01 2023-01-02
```

## コードの主要な仕様

### 日時の扱い

- Twitterから取得する日時はUTC（`datetime` 属性）
- `parse_tweet_element()` 内で+9時間してJSTに変換
- 出力フォーマット: `MM/DD HH:MM`

### 検索クエリ

Twitter Advanced Searchの構文を使用：
```
from:[username] since:[YYYY-MM-DD] until:[YYYY-MM-DD]
```

終了日が省略された場合は `until` パラメータを含めない。

### スクロール処理

- `scrollHeight` を監視して新しいコンテンツの読み込みを検出
- 高さが変わらなくなったら終了
- 各スクロール後に3秒待機

### 重複排除

- `seen_texts` セットでツイート本文を管理
- 同じ本文のツイートは追加しない

## カスタマイズポイント

### 出力フォーマットの変更

`Tweet.to_markdown()` メソッドを編集：

```python
def to_markdown(self, execution_time_str: str) -> str:
    # フォーマットを変更
    date_str = self.date.strftime("%Y-%m-%d %H:%M")  # 例: 年を含める
    clean_text = self.text.replace('\n', ' ').strip()
    return f"- {execution_time_str} 【X】 {date_str} {clean_text}"
```

### タイムゾーンの変更

`parse_tweet_element()` 内の変換処理を編集：

```python
# 現在: JST (UTC+9)
dt = dt + datetime.timedelta(hours=9)

# 例: PST (UTC-8)
dt = dt - datetime.timedelta(hours=8)
```

### スクロール待機時間の調整

ネットワークが遅い場合は待機時間を増やす：

```python
# get_tweets() 内
time.sleep(5)  # 3秒から5秒に変更
```

## デバッグ

### スクリーンショットの保存

ログイン壁検出時にスクリーンショットを保存する機能は削除されていますが、必要に応じて追加可能：

```python
driver.save_screenshot("debug_screenshot.png")
with open("debug.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)
```

### ヘッドレスモードの無効化

デバッグ時はブラウザを表示させる：

```bash
python3 download_tweets.py NASA 2023-01-01
# --headless オプションを付けない
```

## よくある問題と解決策

### 1. ログイン壁が表示される

**原因**: Twitterが自動操作を検出している

**解決策**:
- `undetected-chromedriver` を最新版にアップデート
- プロファイルディレクトリを削除して再ログイン
- 手動ログインを使用

### 2. ツイートが取得できない

**原因**: セレクタが変更された可能性

**解決策**:
- `parse_tweet_element()` のセレクタを確認
- ブラウザの開発者ツールで実際のHTML構造を確認
- `data-testid` 属性が変更されていないか確認

### 3. 日時が正しくない

**原因**: タイムゾーン変換の問題

**解決策**:
- `parse_tweet_element()` のタイムゾーン変換を確認
- `datetime` フォーマットが変更されていないか確認

## 今後の改善案

- [ ] 複数アカウントの一括取得
- [ ] 画像・動画のダウンロード
- [ ] リツイート・引用ツイートの区別
- [ ] プログレスバーの追加
- [ ] ログ出力の改善
- [ ] エラーハンドリングの強化
- [ ] テストコードの追加
- [ ] 設定ファイル（YAML/JSON）のサポート

## コントリビューション

このプロジェクトへの貢献を歓迎します。以下の点にご注意ください：

1. コードスタイルは既存のコードに合わせる
2. 変更内容を明確に説明する
3. Twitterの利用規約を遵守する

## 参考リンク

- [Selenium Documentation](https://www.selenium.dev/documentation/)
- [undetected-chromedriver](https://github.com/ultrafunkamsterdam/undetected-chromedriver)
- [BeautifulSoup Documentation](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)
- [Twitter Advanced Search](https://twitter.com/search-advanced)
