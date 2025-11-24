BINARY_NAME=tweet-downloader
GO_MAIN=cmd/tweet-downloader/main.go

.PHONY: all build clean run deps python-run help

# Default target
all: build

# Build Go binary
build:
	go build -o $(BINARY_NAME) $(GO_MAIN)

# Install Go dependencies
deps:
	go mod tidy

# Clean build artifacts and output files
clean:
	rm -f $(BINARY_NAME)
	rm -f tweets.md
	# Note: chrome_profile is preserved to keep login session

# Run Go version
# Usage: make run ARGS="NASA 2023-01-01"
run: build
	./$(BINARY_NAME) $(ARGS)

# Run Python version
# Usage: make python-run ARGS="NASA 2023-01-01"
python-run:
	python3 download_tweets.py $(ARGS)

# Show help
help:
	@echo "Available commands:"
	@echo "  make build       - Build Go binary (default)"
	@echo "  make run         - Build and run Go binary (Usage: make run ARGS='...')"
	@echo "  make python-run  - Run Python script (Usage: make python-run ARGS='...')"
	@echo "  make deps        - Install Go dependencies"
	@echo "  make clean       - Remove binary and output files"
