package models

import (
	"fmt"
	"strings"
	"time"
)

// Tweet represents a single tweet
type Tweet struct {
	Date     time.Time
	Text     string
	Username string
}

// ToMarkdown converts the tweet to a markdown string
// Format: - [ExecTime] 【X】 [Date] [Text]
func (t *Tweet) ToMarkdown(execTime string) string {
	// Date format: MM/DD HH:MM
	dateStr := t.Date.Format("01/02 15:04")
	
	// Clean text: replace newlines with spaces and strip
	cleanText := strings.ReplaceAll(t.Text, "\n", " ")
	cleanText = strings.TrimSpace(cleanText)
	
	return fmt.Sprintf("- %s 【X】 %s %s", execTime, dateStr, cleanText)
}
