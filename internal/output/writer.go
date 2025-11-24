package output

import (
	"bufio"
	"fmt"
	"os"
	"time"

	"github.com/armaniacs/twitter-tweet-downloader/internal/models"
)

// WriteMarkdown writes tweets to a markdown file
func WriteMarkdown(filename string, tweets []models.Tweet, appendMode bool) error {
	flags := os.O_CREATE | os.O_WRONLY
	if appendMode {
		flags |= os.O_APPEND
	} else {
		flags |= os.O_TRUNC
	}

	file, err := os.OpenFile(filename, flags, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := bufio.NewWriter(file)

	// Capture execution time
	execTime := time.Now().Format("15:04")

	for _, tweet := range tweets {
		line := tweet.ToMarkdown(execTime)
		_, err := fmt.Fprintln(writer, line)
		if err != nil {
			return err
		}
	}

	return writer.Flush()
}
