package browser

import (
	"context"
	"os"
	"path/filepath"

	"github.com/chromedp/chromedp"
)

// SetupContext creates a new chromedp context with custom options
func SetupContext(headless bool) (context.Context, context.CancelFunc) {
	// Get current working directory for profile path
	cwd, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	profileDir := filepath.Join(cwd, "chrome_profile")

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		// User Agent to avoid detection
		chromedp.UserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),

		// Profile directory
		chromedp.UserDataDir(profileDir),

		// Disable automation flags
		chromedp.Flag("enable-automation", false),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),

		// Window size
		chromedp.WindowSize(1920, 1080),
	)

	if !headless {
		opts = append(opts, chromedp.Flag("headless", false))
	}

	allocCtx, cancelAlloc := chromedp.NewExecAllocator(context.Background(), opts...)

	// Create context
	ctx, cancelCtx := chromedp.NewContext(allocCtx)

	// Merge cancels
	cancel := func() {
		cancelCtx()
		cancelAlloc()
	}

	return ctx, cancel
}
