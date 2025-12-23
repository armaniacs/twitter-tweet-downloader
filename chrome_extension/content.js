
// Guard against multiple injections
if (typeof window.tweetDownloaderRunning === 'undefined') {
    window.tweetDownloaderRunning = false;

    console.log("Tweet Downloader Content Script Loaded");

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "PING") {
            sendResponse({ status: "OK" });
            return;
        }

        if (request.action === "EXTRACT") {
            if (window.tweetDownloaderRunning) {
                chrome.runtime.sendMessage({ action: "ERROR", message: "Already running" });
                return;
            }
            window.tweetDownloaderRunning = true;

            // Determine mode
            const url = window.location.href;
            const singleTweetMatch = url.match(/\/status\/(\d+)/);

            if (singleTweetMatch) {
                extractSingleTweet(singleTweetMatch[1]);
            } else {
                extractProfileTweets(request.start, request.end);
            }

            sendResponse({ status: "STARTED" }); // acknowledge
            return true;
        }
    });

    async function extractSingleTweet(targetId) {
        const executionTimeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Extracting single tweet..." });

        try {
            // Wait a bit for content to load if it's a fresh load (though user usually initiates)
            // Search for the article with the ID
            let targetArticle = null;
            let attempts = 0;

            while (!targetArticle && attempts < 5) {
                const articles = document.querySelectorAll('article');
                for (const article of articles) {
                    const parsed = parseTweet(article);
                    if (parsed && parsed.id === targetId) {
                        targetArticle = parsed;
                        break;
                    }
                }
                if (!targetArticle) {
                    await new Promise(r => setTimeout(r, 1000));
                    attempts++;
                }
            }

            if (targetArticle) {
                const row = formatTweet(targetArticle, executionTimeStr);
                chrome.runtime.sendMessage({
                    action: "COMPLETE",
                    data: row,
                    count: 1
                });
            } else {
                throw new Error("Target tweet not found on page. Please ensure the tweet is visible.");
            }

        } catch (e) {
            console.error(e);
            chrome.runtime.sendMessage({ action: "ERROR", message: e.message });
        } finally {
            window.tweetDownloaderRunning = false;
        }
    }

    async function extractProfileTweets(startStr, endStr) {
        const startDate = new Date(startStr);
        const endDate = endStr ? new Date(endStr) : new Date();
        const executionTimeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        let collectedTweets = [];
        let seenIds = new Set();
        let consecutiveOldTweets = 0;
        const MAX_CONSECUTIVE_OLD = 3;
        const MAX_SCROLL_ATTEMPTS = 5;
        let noScrollCount = 0;
        let lastScrollHeight = 0;

        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Starting scrape..." });

        try {
            while (true) {
                const articles = document.querySelectorAll('article');

                for (const article of articles) {
                    const parsed = parseTweet(article);
                    if (!parsed) continue;

                    if (seenIds.has(parsed.id)) continue;
                    seenIds.add(parsed.id);

                    const tweetDate = parsed.date;

                    if (tweetDate >= startDate && tweetDate <= endDate) {
                        collectedTweets.push(parsed);
                        consecutiveOldTweets = 0;
                    } else if (tweetDate < startDate) {
                        const isPinned = article.innerText.includes("Pinned") || article.innerText.includes("固定");
                        if (!isPinned) {
                            consecutiveOldTweets++;
                        }
                    }
                }

                chrome.runtime.sendMessage({
                    action: "UPDATE_STATUS",
                    message: `Collected ${collectedTweets.length} tweets... (Scanned ${seenIds.size})`
                });

                if (consecutiveOldTweets >= MAX_CONSECUTIVE_OLD) {
                    console.log("Reached tweets older than start date.");
                    break;
                }

                lastScrollHeight = document.body.scrollHeight;
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(r => setTimeout(r, 2000));

                if (document.body.scrollHeight === lastScrollHeight) {
                    noScrollCount++;
                    if (noScrollCount >= MAX_SCROLL_ATTEMPTS) {
                        console.log("Reached end of page or stuck.");
                        break;
                    }
                } else {
                    noScrollCount = 0;
                }
            }

            collectedTweets.sort((a, b) => a.date - b.date);

            const markdown = collectedTweets.map(t => formatTweet(t, executionTimeStr)).join('\n');

            chrome.runtime.sendMessage({
                action: "COMPLETE",
                data: markdown,
                count: collectedTweets.length
            });

        } catch (e) {
            console.error(e);
            chrome.runtime.sendMessage({ action: "ERROR", message: e.message });
        } finally {
            window.tweetDownloaderRunning = false;
        }
    }

    function parseTweet(article) {
        try {
            const timeEl = article.querySelector('time');
            if (!timeEl) return null;

            const dtStr = timeEl.getAttribute('datetime');
            const date = new Date(dtStr);

            const textDiv = article.querySelector('div[data-testid="tweetText"]');
            let text = "";
            if (textDiv) {
                // Clone to not modify DOM
                const clone = textDiv.cloneNode(true);

                // Replace images (emojis) with alt text
                const images = clone.querySelectorAll('img');
                for (const img of images) {
                    if (img.alt) {
                        img.replaceWith(document.createTextNode(img.alt));
                    }
                }

                // Handle links: replace <a> with [text](href)
                const links = clone.querySelectorAll('a');
                for (const link of links) {
                    const linkText = link.innerText;
                    const href = link.href;
                    if (linkText && href) {
                        const mdLink = `[${linkText}](${href})`;
                        link.replaceWith(document.createTextNode(mdLink));
                    }
                }

                text = clone.innerText.replace(/\n/g, ' ');
            }

            // ID extraction
            const links = article.querySelectorAll('a');
            let id = null;
            for (const link of links) {
                const match = link.href.match(/\/status\/(\d+)/);
                if (match) {
                    id = match[1];
                    break;
                }
            }
            if (!id) id = dtStr + text.substring(0, 10);

            return {
                id,
                date,
                text,
                dateStr: dtStr
            };
        } catch (e) {
            console.error("Error parsing tweet", e);
            return null;
        }
    }

    function formatTweet(tweet, execTimeStr) {
        // Format: - hh:mm <TAB> 【X】 <TAB> MM/DD hh:mm <TAB> text

        const m = (tweet.date.getMonth() + 1).toString().padStart(2, '0');
        const d = tweet.date.getDate().toString().padStart(2, '0');
        const H = tweet.date.getHours().toString().padStart(2, '0');
        const M = tweet.date.getMinutes().toString().padStart(2, '0');

        const datePart = `${m}/${d} ${H}:${M}`;

        // TSV Separation with Tab
        return `${execTimeStr}\t【X】\t${datePart}\t${tweet.text}`;
    }
}
