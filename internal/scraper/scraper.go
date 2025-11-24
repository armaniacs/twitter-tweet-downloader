package scraper

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/armaniacs/twitter-tweet-downloader/internal/browser"
	"github.com/armaniacs/twitter-tweet-downloader/internal/models"
	"github.com/chromedp/chromedp"
)

// GetTweets fetches tweets for a given username and date range
func GetTweets(username, startDate, endDate string, headless bool) ([]models.Tweet, error) {
	ctx, cancel := browser.SetupContext(headless)
	defer cancel()

	// Build query
	query := fmt.Sprintf("from:%s since:%s", username, startDate)
	if endDate != "" {
		query += fmt.Sprintf(" until:%s", endDate)
	}
	encodedQuery := url.QueryEscape(query)
	searchURL := fmt.Sprintf("https://x.com/search?q=%s&src=typed_query&f=live", encodedQuery)

	fmt.Printf("Navigating to: %s\n", searchURL)

	var tweets []models.Tweet
	seenTexts := make(map[string]bool)

	// Navigate and wait
	err := chromedp.Run(ctx,
		chromedp.Navigate(searchURL),
		chromedp.Sleep(5*time.Second), // Initial load wait
	)
	if err != nil {
		return nil, err
	}

	// Check for login wall or content
	// Simple check: try to find article
	ctxWithTimeout, cancelTimeout := context.WithTimeout(ctx, 10*time.Second)
	defer cancelTimeout()

	err = chromedp.Run(ctxWithTimeout, chromedp.WaitVisible("article"))
	if err != nil {
		fmt.Println("\n" + strings.Repeat("=", 50))
		fmt.Println("Could not find tweets immediately. You might be hit by a login wall.")
		fmt.Println("Please log in to X (Twitter) in the opened browser window.")
		fmt.Println("Once logged in and you see the search results, press Enter in this terminal to continue...")
		fmt.Println(strings.Repeat("=", 50) + "\n")

		if !headless {
			fmt.Println("Press Enter to continue...")
			var input string
			fmt.Scanln(&input)
		} else {
			return nil, fmt.Errorf("headless mode detected, cannot wait for manual login")
		}
	}

	// Scroll loop
	var lastHeight int64
	for {
		// Get articles HTML
		var html string
		err := chromedp.Run(ctx,
			chromedp.OuterHTML("body", &html),
		)
		if err != nil {
			return nil, err
		}

		// Parse HTML
		doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
		if err != nil {
			return nil, err
		}

		doc.Find("article").Each(func(i int, s *goquery.Selection) {
			tweet := parseTweet(s)
			if tweet != nil && !seenTexts[tweet.Text] {
				tweets = append(tweets, *tweet)
				seenTexts[tweet.Text] = true
			}
		})

		fmt.Printf("Collected %d tweets so far...\n", len(tweets))

		// Scroll down
		var newHeight int64
		err = chromedp.Run(ctx,
			chromedp.Evaluate(`window.scrollTo(0, document.body.scrollHeight); document.body.scrollHeight`, &newHeight),
			chromedp.Sleep(3*time.Second),
		)
		if err != nil {
			return nil, err
		}

		if newHeight == lastHeight {
			break
		}
		lastHeight = newHeight
	}

	return tweets, nil
}

func parseTweet(s *goquery.Selection) *models.Tweet {
	// Extract text
	textDiv := s.Find("div[data-testid='tweetText']")
	if textDiv.Length() == 0 {
		return nil
	}
	text := textDiv.Text()

	// Extract time
	timeElement := s.Find("time")
	datetimeStr, exists := timeElement.Attr("datetime")
	if !exists {
		return &models.Tweet{
			Date: time.Now(),
			Text: text,
		}
	}

	// Parse time (2023-12-01T12:00:00.000Z)
	t, err := time.Parse(time.RFC3339, datetimeStr)
	if err != nil {
		return &models.Tweet{
			Date: time.Now(),
			Text: text,
		}
	}

	// Convert to JST (UTC+9)
	jst := time.FixedZone("Asia/Tokyo", 9*60*60)
	t = t.In(jst)

	return &models.Tweet{
		Date: t,
		Text: text,
	}
}
