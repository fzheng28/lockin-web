# LockedIn Warden

LockedIn Warden is a Chrome extension designed to help users stay focused and productive by actively identifying and mitigating digital distractions. It employs a multi-layered approach, combining static blocking with intelligent AI-powered content analysis and a behavioral learning system, to create a personalized browsing environment conducive to work or study.

## Features

### 1. Layer 1: The "Hard Wall" (Static Blocking)
- **Pre-defined Blacklist:** Automatically blocks access to a configurable list of known distracting websites (e.g., social media platforms like Instagram, TikTok, Twitter, Facebook, and YouTube Shorts).
- **Instant Redirect:** Redirects users to a neutral `blocked.html` page when a blacklisted site is detected.

### 2. Layer 2: The "AI Eye" (Contextual Analysis)
- **Intelligent Content Evaluation:** Utilizes the Gemini AI model to analyze the content of visited webpages (Page Title, URL, and a content snippet) to determine if they are productive or distracting.
- **Dynamic Classification:** Categorizes pages into three states:
    - **CONDUCIVE (Productive):** Includes AI tools (ChatGPT, Gemini, Claude, Github Copilot), technical documentation (StackOverflow, MDN), project management platforms (Jira, Trello, Notion), and educational platforms (Coursera, Khan Academy).
    - **DISTRACTING:** Encompasses infinite scroll feeds (Twitter/X, Facebook, Instagram), short-form video (TikTok, YouTube Shorts, Reels), entertainment (Netflix, Twitch, IGN), or clickbait news.
    - **MIXED:** For pages that don't fit clearly into either category.
- **YouTube Exception:** Features specific logic for YouTube; titles indicating tutorials or coding are considered productive, while vlogs, gaming, or entertainment-focused titles lead to a distracting classification.
- **"Glass Wall" Effect:** When a page is deemed "DISTRACTING" by the AI, a blurred overlay is applied, making the content less accessible and encouraging users to refocus.

### 3. Layer 3: Behavioral Learning (Strike System)
- **Manual Striking:** Users can manually "strike" a page they find distracting.
- **Adaptive Blacklisting:** If a user accumulates a set number of strikes (default: 2S) for a specific domain, that domain is automatically added to the Layer 1 static blacklist, enhancing personalized blocking over time.

### 4. API Quota Management
- **Intelligent Caching:** Implements an in-memory caching mechanism that stores AI analysis results for recently visited URLs (for 5 minutes). This prevents redundant API calls to the Gemini service, reducing the likelihood of hitting API usage limits, especially for frequently revisited pages.

## How it Works

LockedIn Warden operates as a background service within your browser. When you navigate to a new page:
1.  It first checks if the URL is on the static blacklist (Layer 1). If yes, it's blocked instantly.
2.  If not blacklisted, it checks its internal cache to see if this URL has been analyzed recently.
3.  If a valid cached analysis exists, it uses that result.
4.  If no valid cached analysis is found, the content script extracts key information (title, URL, content snippet) from the page and sends it to the background script.
5.  The background script then sends this information to the Gemini AI for real-time evaluation against the defined productivity rules.
6.  Based on the AI's "DISTRACTING" classification, a visual "glass wall" is applied to the webpage.
7.  Manual strikes contribute to a domain's strike count, leading to eventual static blacklisting for persistent distractions.

## Installation & Setup

1.  Clone this repository to your local machine.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable "Developer mode" using the toggle in the top right.
4.  Click "Load unpacked" and select the directory where you cloned this repository.
5.  Ensure you have a valid Google Gemini API key. Replace `"AIzaSyCbdJGSzUMDHYEjme05PVUDo6WrcxeNanc"` in `background.js` with your actual API key.
6.  Reload the extension after any changes to its files or API key.

## Limitations (API Quota)

The AI-powered analysis relies on the Gemini API, which has usage limits (especially on the free tier). Frequent browsing of unique pages can quickly exhaust this quota, leading to `429 RESOURCE_EXHAUSTED` errors. While the caching mechanism helps, heavy users may need to:
- Upgrade their Gemini API plan to a paid tier.
- Request a quota increase through the Google Cloud Console.

## Contributing

(Placeholder for future contribution guidelines)

## License

(Placeholder for license information)
