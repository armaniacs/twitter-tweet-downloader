import argparse
import time
import datetime
from dataclasses import dataclass
from typing import List

import os
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup

@dataclass
class Tweet:
    date: datetime.datetime
    text: str
    username: str
    
    def to_markdown(self, execution_time_str: str) -> str:
        # Format: - hh:mm 【X】 MM/DD hh:mm 本文
        # execution_time_str is the first hh:mm
        date_str = self.date.strftime("%m/%d %H:%M")
        clean_text = self.text.replace('\n', ' ').strip()
        return f"- {execution_time_str} 【X】 {date_str} {clean_text}"

def setup_driver(headless: bool = False):
    options = uc.ChromeOptions()
    if headless:
        options.add_argument('--headless')
    
    # Save profile to current directory to persist login
    profile_dir = os.path.join(os.getcwd(), "chrome_profile")
    options.add_argument(f'--user-data-dir={profile_dir}')
    
    # undetected_chromedriver handles driver installation automatically
    driver = uc.Chrome(options=options)
    return driver

def parse_tweet_element(element) -> Tweet:
    try:
        html = element.get_attribute('outerHTML')
        soup = BeautifulSoup(html, 'html.parser')
        
        # Extract text
        text_div = soup.find('div', {'data-testid': 'tweetText'})
        text = text_div.get_text(separator=' ') if text_div else ""
        
        # Extract time
        time_element = soup.find('time')
        if time_element and time_element.has_attr('datetime'):
            dt_str = time_element['datetime']
            # Format example: 2023-12-01T12:00:00.000Z
            dt = datetime.datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S.%fZ")
            # Convert to JST (simple addition for now, better to use timezone lib if strict)
            dt = dt + datetime.timedelta(hours=9) 
        else:
            dt = datetime.datetime.now() # Fallback
            
        # Extract username (just for verification if needed)
        # user_div = soup.find('div', {'data-testid': 'User-Name'})
        
        return Tweet(date=dt, text=text, username="")
    except Exception as e:
        print(f"Error parsing tweet: {e}")
        return None

def get_tweets(username: str, start_date: str, end_date: str = None, headless: bool = False) -> List[Tweet]:
    driver = setup_driver(headless)
    tweets_data = []
    seen_texts = set()
    
    try:
        # Twitter Advanced Search URL
        # f=live to get latest tweets
        if end_date:
            query = f"from:{username} since:{start_date} until:{end_date}"
        else:
            query = f"from:{username} since:{start_date}"
            
        import urllib.parse
        encoded_query = urllib.parse.quote(query)
        url = f"https://x.com/search?q={encoded_query}&src=typed_query&f=live"
        
        print(f"Navigating to: {url}")
        driver.get(url)
        
        # Wait for initial load - increase time
        time.sleep(10)
        
        last_height = driver.execute_script("return document.body.scrollHeight")
        
        # Check for login wall or errors
        try:
            # Try to find at least one article
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "article")))
        except:
            print("\n" + "="*50)
            print("Could not find tweets immediately. You might be hit by a login wall.")
            print("Please log in to X (Twitter) in the opened browser window.")
            print("Once logged in and you see the search results, press Enter in this terminal to continue...")
            print("="*50 + "\n")
            if not headless:
                input("Press Enter to continue...")
            else:
                print("Headless mode detected, cannot wait for manual login. Exiting.")
                return []
        
        while True:
            # Find tweet elements
            articles = driver.find_elements(By.TAG_NAME, "article")
            
            if not articles:
                 # Retry once after a short sleep in case of slow load after login
                 time.sleep(5)
                 articles = driver.find_elements(By.TAG_NAME, "article")
                 if not articles:
                     print("No articles found. Stopping.")
                     break

            for article in articles:
                tweet = parse_tweet_element(article)
                if tweet and tweet.text not in seen_texts:
                    # Verify date range strictly if needed, but search query handles most
                    tweets_data.append(tweet)
                    seen_texts.add(tweet.text)
            
            # Scroll down
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3) # Wait for load
            
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                # End of scroll
                break
            last_height = new_height
            
            print(f"Collected {len(tweets_data)} tweets so far...")
            
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        driver.quit()
        
    # Sort by date (descending from search, but maybe we want ascending?)
    # User didn't specify order, but usually lists are chronological or reverse.
    # Let's sort by date ascending.
    tweets_data.sort(key=lambda x: x.date)
    
    return tweets_data

    # Load .env manually to avoid dependency
    default_username = None
    env_path = os.path.join(os.getcwd(), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.strip().startswith('TWITTER_USERNAME='):
                    default_username = line.strip().split('=', 1)[1]
                    break

    # Parse args with defaults
    parser = argparse.ArgumentParser(description='Download tweets from a specific user in a date range.')
    parser.add_argument('username', type=str, nargs='?', default=default_username, help='Twitter username (without @)')
    parser.add_argument('start_date', type=str, nargs='?', help='Start date (YYYY-MM-DD)')
    parser.add_argument('end_date', type=str, nargs='?', help='End date (YYYY-MM-DD). Optional, defaults to now.')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    parser.add_argument('--output', type=str, default='tweets.md', help='Output file name')
    
    args = parser.parse_args()
    
    if not args.username:
        print("Error: Username is required. Provide it as an argument or set TWITTER_USERNAME in .env")
        return

    # Resume logic if start_date is missing
    if not args.start_date:
        if os.path.exists(args.output):
            print(f"No start date provided. Checking {args.output} for the last tweet date...")
            try:
                last_date_str = None
                with open(args.output, 'r', encoding='utf-8') as f:
                    for line in f:
                        # Format: - HH:MM 【X】 MM/DD HH:MM Text
                        if "【X】" in line:
                            parts = line.split("【X】")
                            if len(parts) > 1:
                                date_part = parts[1].strip().split(' ')[0] # MM/DD
                                last_date_str = date_part
                
                if last_date_str:
                    # Parse MM/DD and guess year
                    now = datetime.datetime.now()
                    try:
                        md = datetime.datetime.strptime(last_date_str, "%m/%d")
                        # Assign current year
                        dt = md.replace(year=now.year)
                        # If date is in future, it must be last year
                        if dt > now:
                            dt = dt.replace(year=now.year - 1)
                        
                        # Start from the next day to avoid duplicates (or same day if we want to be safe)
                        # Let's use the same day to be safe, scraping logic handles duplicates via seen_texts if in same run,
                        # but across runs, we might want to overlap.
                        # User said "continue from", usually implies next day or overlapping.
                        # Let's set start_date to the detected date.
                        args.start_date = dt.strftime("%Y-%m-%d")
                        print(f"Resuming from {args.start_date} (detected from {args.output})")
                    except ValueError:
                        print("Error parsing date from file.")
            except Exception as e:
                print(f"Error reading output file: {e}")

    if not args.start_date:
        print("Error: Start date is required and could not be inferred from output file.")
        return

    # Capture execution time
    execution_time_str = datetime.datetime.now().strftime("%H:%M")
    
    end_msg = args.end_date if args.end_date else "now"
    print(f"Fetching tweets for @{args.username} from {args.start_date} to {end_msg}...")
    tweets = get_tweets(args.username, args.start_date, args.end_date, args.headless)
    
    print(f"Total tweets found: {len(tweets)}")
    
    # Append mode if resuming? 
    # The user said "download from the continuation".
    # If we overwrite, we lose previous history.
    # Usually "resume" implies appending.
    # But previous implementation was 'w' (overwrite).
    # If we change to append, we need to handle the file mode.
    # Let's check if we inferred start_date from file, if so, we should probably append.
    # However, the user request "download from the continuation" might just mean "get new tweets".
    # If we overwrite, the old tweets are gone. That seems bad for a "downloader".
    # Let's change to Append mode ('a') if the file exists, or maybe just always append?
    # But if user specifies a range explicitly, maybe they want a fresh file?
    # Let's stick to 'a' (append) if we are resuming, but the user didn't explicitly ask to change file mode, 
    # but "download from the continuation" strongly implies keeping the old ones.
    # Let's use 'a' if file exists, 'w' if not?
    # Or better: read existing, combine, sort, write back? That ensures order.
    # For now, to keep it simple and safe:
    # If we inferred start_date, we definitely want to append.
    
    mode = 'w'
    if os.path.exists(args.output) and args.start_date:
        # If we are just adding new tweets, append.
        # But wait, if user manually specifies start_date, maybe they want to overwrite?
        # Let's assume if file exists, we append.
        mode = 'a'
        print(f"Appending to {args.output}")

    with open(args.output, mode, encoding='utf-8') as f:
        for tweet in tweets:
            f.write(tweet.to_markdown(execution_time_str) + "\n")
            
    print(f"Saved to {args.output}")

if __name__ == "__main__":
    main()
