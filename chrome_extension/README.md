# Tweet Downloader Chrome Extension

This extension allows you to download tweets from a user's profile page and convert them to Markdown format.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `chrome_extension` directory in this project.

## Usage

### Profile Mode
1. Navigate to a Twitter (X) user profile page (e.g., `https://x.com/username`).
   - **Note**: You must be logged in to X.
2. Click the extension icon in the toolbar.
3. Select the date range you want to download (e.g., Today, Yesterday, This Week).
   - You can also specify a **Custom Range**.
   - If you have used the extension before, you can check **Resume from last download** to fetch tweets posted since your last run.
4. Click **Extract Tweets**.
   - The extension will automatically scroll the page to find tweets.
   - Please wait while it processes. Do not close the tab or popup (keep popup open!).

### Single Tweet Mode
1. Navigate to a single tweet page (e.g., `https://x.com/user/status/123456789`).
2. Click the extension icon.
3. Click **Extract Tweets**.
   - The extension will ignore date settings and extract only the current tweet.

## Output Format

The output is in TSV (Tab-Separated Values) format within a Markdown list:

```markdown
ExecutionTime <TAB> 【X】 <TAB> Date Time <TAB> Tweet Text (with Markdown links)
```

Example:
```markdown
10:00	【X】	12/23 09:30	This is a tweet with [a link](https://x.com)
```

## Troubleshooting

- **Popup closes**: You must keep the popup open while the extraction is running.
- **No tweets found**: Ensure the page has loaded and you are on the limits of the timeline.
- **Login required**: Make sure you are logged in to X.
