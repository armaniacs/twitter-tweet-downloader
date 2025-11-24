package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/armaniacs/twitter-tweet-downloader/internal/output"
	"github.com/armaniacs/twitter-tweet-downloader/internal/scraper"
)

func loadEnv() map[string]string {
	env := make(map[string]string)
	file, err := os.Open(".env")
	if err != nil {
		return env
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "TWITTER_USERNAME=") {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				env["TWITTER_USERNAME"] = parts[1]
			}
		}
	}
	return env
}

func getLastDateFromMarkdown(filename string) (string, error) {
	file, err := os.Open(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	var lastDateStr string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		// Format: - HH:MM 【X】 MM/DD HH:MM Text
		if strings.Contains(line, "【X】") {
			parts := strings.Split(line, "【X】")
			if len(parts) > 1 {
				datePart := strings.TrimSpace(parts[1])
				fields := strings.Fields(datePart)
				if len(fields) > 0 {
					lastDateStr = fields[0] // MM/DD
				}
			}
		}
	}
	return lastDateStr, nil
}

func main() {
	headless := flag.Bool("headless", false, "Run in headless mode")
	outputFile := flag.String("output", "tweets.md", "Output file name")
	flag.Parse()

	args := flag.Args()
	env := loadEnv()

	var username, startDate, endDate string

	// 1. Determine Username
	if len(args) > 0 {
		username = args[0]
	} else {
		username = env["TWITTER_USERNAME"]
	}

	if username == "" {
		fmt.Println("Error: Username is required. Provide it as an argument or set TWITTER_USERNAME in .env")
		os.Exit(1)
	}

	// 2. Determine Start Date
	if len(args) > 1 {
		startDate = args[1]
	} else {
		// Try to infer from output file
		lastDateStr, err := getLastDateFromMarkdown(*outputFile)
		if err == nil && lastDateStr != "" {
			// Parse MM/DD
			now := time.Now()
			t, err := time.Parse("01/02", lastDateStr)
			if err == nil {
				// Assign current year
				t = t.AddDate(now.Year(), 0, 0)
				// If date is in future, it must be last year
				if t.After(now) {
					t = t.AddDate(-1, 0, 0)
				}
				startDate = t.Format("2006-01-02")
				fmt.Printf("Resuming from %s (detected from %s)\n", startDate, *outputFile)
			}
		}
	}

	if startDate == "" {
		fmt.Println("Error: Start date is required and could not be inferred from output file.")
		fmt.Println("Usage: tweet-downloader [username] [start_date] [end_date (optional)]")
		os.Exit(1)
	}

	// 3. Determine End Date
	if len(args) > 2 {
		endDate = args[2]
	}

	endMsg := endDate
	if endMsg == "" {
		endMsg = "now"
	}

	fmt.Printf("Fetching tweets for @%s from %s to %s...\n", username, startDate, endMsg)

	startTime := time.Now()
	tweets, err := scraper.GetTweets(username, startDate, endDate, *headless)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Total tweets found: %d\n", len(tweets))
	fmt.Printf("Time elapsed: %v\n", time.Since(startTime))

	// Append mode logic
	// In Go implementation, we need to modify WriteMarkdown to support append or handle it here
	// For simplicity, let's update WriteMarkdown in internal/output/writer.go to support append mode
	// But here we can't easily change the signature without editing another file.
	// Let's assume we will edit internal/output/writer.go next.
	// For now, let's pass a flag or handle file opening in WriteMarkdown.
	// Let's change WriteMarkdown to accept a flag 'append'

	err = output.WriteMarkdown(*outputFile, tweets, true) // Always append for safety/resume?
	// Wait, if user explicitly runs a new range, maybe they want overwrite?
	// But if we are resuming, we definitely want append.
	// Let's make WriteMarkdown smart or just always append if file exists?
	// The Python version logic was: if file exists, append.

	if err != nil {
		fmt.Printf("Error writing output: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Saved to %s\n", *outputFile)
}
