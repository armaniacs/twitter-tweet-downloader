# Chrome Extension Development Guide

Tweet Downloader Chrome Extension の開発者向けガイドです。

## プロジェクト構成

```
chrome_extension/
├── manifest.json   # 拡張機能の設定 (Manifest V3)
├── popup.html      # ポップアップUI
├── popup.js        # UIロジック（設定保存、スクリプト注入トリガー）
├── content.js      # ページ内スクリプト（スクレイピング、DOM操作）
├── icons/          # アイコンファイル
└── README.md       # ユーザー向け説明
```

## 開発フロー

1. **コードの変更**: `popup.js` や `content.js` などを編集します。
2. **拡張機能の再読み込み**:
   - `chrome://extensions/` を開きます。
   - "Twitter Tweet Downloader" の更新ボタン（矢印）をクリックします。
3. **ページのリロード**:
   - Twitterのページをリロードして、新しい `content.js` が注入されるようにします。

## アーキテクチャ

### Manifest V3
- **Permissions**: `activeTab`, `scripting`, `storage`
- **Host Permissions**: `x.com`, `twitter.com`

### コンポーネント間連携
1. **Popup (`popup.js`)**:
   - ユーザー設定（日付範囲など）を取得。
   - `chrome.tabs.sendMessage` で Content Script に指令を送る。
   - Resume機能のために `chrome.storage.local` に最終実行日時を保存。

2. **Content Script (`content.js`)**:
   - `EXTRACT` メッセージを受け取ると動作開始。
   - DOMを解析し、`article` 要素からツイートを抽出。
   - 自動スクロール制御。
   - Markdown/TSVフォーマット変換。
   - 進捗状況を `runtime.sendMessage` で Popup に報告。

## リリース手順

1. `chrome_extension` フォルダの中身を確認（不要なファイルがないか）。
2. フォルダをzip圧縮する。
   ```bash
   zip -r tweet-downloader-extension.zip chrome_extension/
   ```
3. Chrome Web Store Developer Dashboard にアップロード（公開する場合）。
