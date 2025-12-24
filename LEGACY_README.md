# [DEPRECATED] Twitter Tweet Downloader (Python/Go)

> [!WARNING]
> This legacy documentation covers the Python and Go script versions. The project has migrated to a Chrome Extension. Please see [README.md](README.md) for the latest information.

# Twitter Tweet Downloader

特定のTwitterアカウントの指定期間のツイートをダウンロードし、Markdown形式で保存するツールです。

## 特徴

- 🔍 **期間指定取得**: 開始日から終了日（または現在）までのツイートを取得
- 📝 **Markdown出力**: 見やすいMarkdownリスト形式で保存
- 🔐 **ログイン対応**: undetected-chromedriverによる検出回避
- 💾 **プロファイル保存**: 一度ログインすれば次回以降は不要

## インストール

### 前提条件

- Python 3.x
- Google Chrome

### 依存ライブラリのインストール

```bash
pip install selenium webdriver-manager beautifulsoup4 undetected-chromedriver
```

## Go言語版の使い方

Go言語版はシングルバイナリとして動作し、Python環境が不要です。

### ビルド

```bash
go build -o tweet-downloader cmd/tweet-downloader/main.go
```

### 実行

```bash
# 基本的な使用法
./tweet-downloader [ユーザー名] [開始日] [終了日]

# 例
./tweet-downloader NASA 2023-01-01 2023-01-05
```

### 省略時の挙動（新機能）

1. **ユーザー名の省略**: `.env` ファイルの `TWITTER_USERNAME` を使用します。
2. **開始日の省略**: `.lasttime.TWITTER_USERNAME` (例: `.lasttime.NASA`) をよみこみ、直近に動作させた時刻を取得する。このとき、既存の出力ファイル（デフォルト: `tweets.ユーザー名.md`）は `.tweets.old.ユーザー名.以前取得した時間.md` にリネームされます。ファイルが存在しないときは、出力ファイルを読み込み、最後に取得された日付の続きから開始します。
3. **終了日の省略**: 現在時刻まで取得します。

```bash
# .env設定済みで、続きから最新まで取得する場合
./tweet-downloader
```

オプション:
- `--headless`: ヘッドレスモードで実行
- `--output`: 出力ファイル名を指定 (デフォルト: `tweets.ユーザー名.md`)

## 設定ファイル (.env)

デフォルトのユーザー名を設定するには、プロジェクトルートに `.env` ファイルを作成します：

```env
TWITTER_USERNAME=NASA
```

## Python版の使い方

### 基本的な使用法

```bash
# 期間を指定してツイートを取得
python3 download_tweets.py [ユーザー名] [開始日] [終了日]

# 例: NASAの2023年1月1日から1月5日までのツイートを取得
python3 download_tweets.py NASA 2023-01-01 2023-01-05
```

### 最新まで取得

終了日を省略すると、開始日から現在までのツイートを取得します。

```bash
python3 download_tweets.py NASA 2023-01-01
```

### オプション

- `--headless`: ヘッドレスモードで実行（ログインが必要な場合は使用不可）
- `--output [ファイル名]`: 出力ファイル名を指定（デフォルト: `tweets.md`）

## 出力フォーマット

```markdown
- 05:32 【X】 01/01 12:00 ツイート本文...
- 05:32 【X】 01/02 15:30 ツイート本文...
```

- 先頭の時刻（`05:32`）: スクリプトを実行した時刻
- `【X】`: Twitter/Xのマーカー
- 日時（`01/01 12:00`）: ツイートが投稿された日時
- 本文: ツイートの内容

## ログインについて

初回実行時、Twitterのログイン画面が表示される場合があります。

1. ブラウザが起動し、検索画面にアクセスします
2. ログイン画面が表示されたら、ターミナルに案内が表示されます
3. ブラウザ上でログインしてください
4. ログイン完了後、ターミナルでEnterキーを押すと取得を開始します

ログイン情報は `chrome_profile` フォルダに保存され、次回以降はログイン不要です。

## 注意事項

- Twitterの仕様変更により、突然動作しなくなる可能性があります
- 過度なアクセスはアカウント制限の対象となる可能性があります
- スクレイピング実行中はブラウザを閉じないでください

## トラブルシューティング

### ツイートが取得できない

- ログインが必要な場合があります。ヘッドレスモードを使用せず、手動でログインしてください
- アカウントが非公開の場合、取得できません
- 日付の範囲が広すぎる場合、時間がかかることがあります

### ブラウザが起動しない

- Google Chromeがインストールされているか確認してください
- `undetected-chromedriver` が正しくインストールされているか確認してください

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルをご覧ください。
