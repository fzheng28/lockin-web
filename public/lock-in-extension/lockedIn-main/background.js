// background.js

// Backend API (keep your Gemini key on the server, not in the extension).
// For local dev: http://localhost:3001
// For production: https://YOUR_RENDER_URL
const BACKEND_BASE_URL = "https://lockin-web.onrender.com";
// Optional shared secret header (matches EXTENSION_SHARED_SECRET on the backend).
const EXTENSION_SHARED_SECRET = "";
const STRIKE_LIMIT = 2;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const SIMILARITY_MATCH_THRESHOLD = 1; // number of signals needed to treat as similar
const KNOWN_STREAMING_DOMAINS = [
    "netflix.com",
    "hulu.com",
    "disneyplus.com",
    "primevideo.com",
    "max.com",
    "hbomax.com",
    "paramountplus.com",
    "peacocktv.com",
    "tubitv.com",
    "pluto.tv",
    "crunchyroll.com",
    "viki.com",
    "iq.com",
    "iqiyi.com",
    "bilibili.com",
    "youtube.com/shorts"
];
const TEMP_ALLOW_MINUTES_DEFAULT = 20;

// Layer 4: In-memory cache
const pageCache = new Map();



// ============================================
// Main Classification Engine
// ============================================
async function classify(url, title, tabId) {
    const urlObject = new URL(url);
    const domain = urlObject.hostname.replace('www.', '');
    const urlKey = getUrlKey(urlObject);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 CLASSIFY: Processing ${domain}`);
    console.log(`${'='.repeat(60)}`);

    // 0. User allowlist (full path)
    const allowResult = await isAllowedByUser(urlKey);
    if (allowResult.allowed) {
        console.log(`✅ ALLOWLIST HIT: ${allowResult.reason} for ${urlKey}`);
        return { classification: 'CONDUCIVE', source: 'allowlist', blockType: 'none' };
    }

    // 1. Check cache first
    if (pageCache.has(url) && pageCache.get(url).expires > Date.now()) {
        console.log(`✅ CACHE HIT: Using cached result for ${domain}`);
        return pageCache.get(url).data;
    }
    console.log(`❌ CACHE MISS: Need to evaluate ${domain}`);

    // 2. Layer 1: The "Hard Wall" (Static Blocking)
    const { blacklist = [] } = await chrome.storage.local.get("blacklist");
    const isBlacklisted = blacklist.some(blockedDomain => url.includes(blockedDomain));
    if (isBlacklisted) {
        console.log(`🚫 LAYER 1 HIT: Domain is in blacklist`);
        return { classification: 'DISTRACTING', source: 'static_blacklist', blockType: 'hard_block' };
    }

    // 3. Layer 3: Behavioral Learning (Strike System)
    const { strikeCounts = {} } = await chrome.storage.local.get("strikeCounts");
    const strikeCount = strikeCounts[domain] || 0;
    console.log(`⚡ Current strikes for ${domain}: ${strikeCount}/${STRIKE_LIMIT}`);

    if (strikeCount >= STRIKE_LIMIT) {
        console.log(`🔴 LAYER 3 HIT: Strike limit reached, hard-blocking ${domain}`);
        if (!blacklist.includes(domain)) {
            // Automatically add to blacklist if strike limit is reached
            await chrome.storage.local.set({ blacklist: [...blacklist, domain] });
        }
        // Remove from strike counts once it's hard-blocked
        const updatedStrikeCounts = { ...strikeCounts };
        delete updatedStrikeCounts[domain];
        await chrome.storage.local.set({ strikeCounts: updatedStrikeCounts });
        
        return { classification: 'DISTRACTING', source: 'strike_system', blockType: 'hard_block', strikeCount };
    }

    // 3.5 Similarity matching (strike-learned patterns)
    const { strikePatterns = [] } = await chrome.storage.local.get("strikePatterns");
    const similarity = isSimilarToStrikePattern(urlObject, strikePatterns);
    if (similarity.isSimilar) {
        console.log(`🧩 SIMILARITY HIT: Matched strike pattern (${similarity.reason})`);
        return { classification: 'DISTRACTING', source: 'similarity_match', blockType: 'glass_wall', strikeCount };
    }

    // 3.7 Known streaming domains (skip Gemini)
    if (KNOWN_STREAMING_DOMAINS.some(d => domain.includes(d))) {
        console.log(`📺 STREAMING HIT: Skipping Gemini for ${domain}`);
        return { classification: 'DISTRACTING', source: 'known_streaming', blockType: 'glass_wall', strikeCount };
    }

    // 4. Layer 2: The "AI Eye" (Contextual Analysis)
    let pageSnippet = '';
    if (tabId) {
        pageSnippet = await getPageSnippet(tabId);
    }

    console.log(`🤖 LAYER 2: Calling backend for context analysis...`);
    const prompt = buildGeminiPrompt(urlObject, title, strikeCount, pageSnippet);
    console.log(`🧾 Prompt preview (not sent to backend): ${prompt.slice(0, 300)}...`);
    const aiClassification = await callBackend(urlObject.href, title, pageSnippet);

    // 5. Process AI result
    const result = {
        classification: aiClassification,
        source: 'ai',
        strikeCount: strikeCount,
        // As per README, "glass wall" is for DISTRACTING results from the AI
        blockType: aiClassification === 'DISTRACTING' ? 'glass_wall' : 'none'
    };

    // 6. Cache the result
    pageCache.set(url, {
        data: result,
        expires: Date.now() + CACHE_DURATION_MS
    });

    console.log(`✅ CLASSIFICATION COMPLETE for ${domain}:`, result);
    console.log(`${'='.repeat(60)}\n`);

    return result;
}



// ============================================
// Gemini API and Prompt Functions
// ============================================
async function callBackend(url, title, pageSnippet) {
  try {
    console.log(`📡 Sending request to backend...`);
    const headers = { 'Content-Type': 'application/json' };
    if (EXTENSION_SHARED_SECRET) {
      headers['x-extension-secret'] = EXTENSION_SHARED_SECRET;
    }

    const response = await fetch(
      `${BACKEND_BASE_URL}/api/classify-tab`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, title, pageSnippet })
      }
    );

    console.log(`📊 Backend Response Status: ${response.status}`);

    if (!response.ok) {
      const respText = await response.text();
      console.error('❌ Backend Error Response:', respText);
      throw new Error(`Backend call failed with status: ${response.status}`);
    }

    const data = await response.json();
    const classification = (data && data.classification) ? data.classification : 'MIXED';
    console.log(`✅ Backend call succeeded with classification: ${classification}`);
    return classification;
  } catch (error) {
      console.error("❌ Error calling backend:", error);
      return 'MIXED'; // Fallback classification on error
  }
}

function buildGeminiPrompt(urlObject, title, strikeCount, pageSnippet) {
  const domain = urlObject.hostname.replace('www.', '');

  // README: "YouTube Exception: titles indicating tutorials or coding are considered productive"
  if (domain.includes('youtube.com')) {
      if (title.match(/tutorial|learn|course|guide|programming|coding/i)) {
          // This logic is handled before the AI call now, but we can still have a more specific prompt
          return `This is a YouTube video with title "${title}". Based on the title, it seems educational. Confirm if this is CONDUCIVE.`;
      }
      if (title.match(/vlog|funny|gaming|prank|reaction/i)) {
           return `This is a YouTube video with title "${title}". Based on the title, it seems like entertainment. Confirm if this is DISTRACTING.`;
      }
  }

  const snippetBlock = pageSnippet
    ? `\nPage Snippet (truncated):\n"${pageSnippet}"`
    : '';

  return `You are a productivity classifier. Analyze the webpage and classify it as CONDUCIVE, DISTRACTING, or MIXED.

Webpage Info:
- Title: "${title}"
- Domain: "${domain}"
- URL: "${urlObject.href}"
- User Strikes for this domain: ${strikeCount}
${snippetBlock}

Classification Guidelines:
- CONDUCIVE: Work, learning, technical research (StackOverflow, MDN), project management (Jira, Trello), educational platforms.
- DISTRACTING: Social media feeds, short-form video (TikTok, Reels), streaming (Netflix), clickbait, pure entertainment.
- MIXED: News sites, forums like Reddit, or anything that could be either productive or distracting.

Based on the info, respond with ONLY ONE WORD: CONDUCIVE, DISTRACTING, or MIXED.`;
}


// ============================================
// Chrome Extension Event Listeners
// ============================================

// On page update (navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only classify if monitoring is active
    const { monitoringState } = await chrome.storage.local.get("monitoringState");
    if (!monitoringState) {
        return;
    }

    // Ensure the page is fully loaded and has a valid URL
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://') && tab.title) {
        try {
            // Inject content.js before sending any messages to ensure it's active
            await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });

            // Get a small on-page snippet to improve classification
            // Then send message to inject flag button
            chrome.tabs.sendMessage(tabId, { type: "INJECT_FLAG_BUTTON" }).catch(e => {
                console.warn(`Could not inject flag button into tab ${tabId}:`, e.message);
            });

            console.log(`🔍 Classifying: ${tab.url}`);
            const result = await classify(tab.url, tab.title, tabId);

            console.log(`✅ Classification result for ${tab.url}:`, result);

            if (result.blockType === 'hard_block') {
                console.log(`🚫 Hard blocking: ${tab.url}`);
                chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
            } else if (result.blockType === 'glass_wall') {
                console.log(`⚠️ Applying glass wall to: ${tab.url}`);
                chrome.tabs.sendMessage(tabId, { type: "APPLY_GLASS_DOOR", strikeCount: result.strikeCount }).catch(e => {
                    console.warn(`Could not apply glass door to tab ${tabId}:`, e.message);
                });
            } else {
                console.log(`✨ Allowing: ${tab.url}`);
            }
        } catch (error) {
            console.error(`Error processing tab ${tabId}:`, error);
        }
    }
});

// On message from content scripts or UI
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "MANUAL_STRIKE") {
        handleUserStrike(request.data.url, sender.tab);
        return true; // Indicates an async response
    }
    if (request.type === "CLOSE_CURRENT_TAB") {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
        }
        return true;
    }
    if (request.type === "ALLOW_PATH_PERMANENT") {
        (async () => {
            const url = request.data?.url || request.url;
            if (!url) {
                sendResponse({ success: false, error: "Missing URL" });
                return;
            }
            const urlKey = getUrlKey(new URL(url));
            const { allowlistPaths = [] } = await chrome.storage.local.get("allowlistPaths");
            if (!allowlistPaths.includes(urlKey)) {
                await chrome.storage.local.set({ allowlistPaths: [...allowlistPaths, urlKey] });
            }
            pageCache.delete(url);
            sendResponse({ success: true });
        })();
        return true;
    }
    if (request.type === "ALLOW_PATH_TEMP") {
        (async () => {
            const url = request.data?.url || request.url;
            const minutes = request.data?.minutes ?? TEMP_ALLOW_MINUTES_DEFAULT;
            if (!url) {
                sendResponse({ success: false, error: "Missing URL" });
                return;
            }
            const urlKey = getUrlKey(new URL(url));
            const expiresAt = Date.now() + minutes * 60 * 1000;
            const { tempAllowPaths = [] } = await chrome.storage.local.get("tempAllowPaths");
            const updated = tempAllowPaths.filter(entry => entry.urlKey !== urlKey);
            updated.push({ urlKey, expiresAt });
            await chrome.storage.local.set({ tempAllowPaths: updated });
            pageCache.delete(url);
            sendResponse({ success: true, expiresAt });
        })();
        return true;
    }

    if (request.message) {
        return handleUiMessage(request, sendResponse);
    }
});

async function handleUserStrike(url, tab) {
    const domain = new URL(url).hostname.replace('www.', '');
    const urlObject = new URL(url);

    const { strikeCounts = {} } = await chrome.storage.local.get("strikeCounts");
    const newStrikeCount = (strikeCounts[domain] || 0) + 1;
    strikeCounts[domain] = newStrikeCount;
    await chrome.storage.local.set({ strikeCounts });

    // Store similarity patterns for future matches
    const { strikePatterns = [] } = await chrome.storage.local.get("strikePatterns");
    const newPattern = buildStrikePattern(urlObject);
    const mergedPatterns = mergeStrikePatterns(strikePatterns, newPattern);
    await chrome.storage.local.set({ strikePatterns: mergedPatterns });

    console.log(`User struck ${domain}. New count: ${newStrikeCount}`);
    pageCache.delete(url); // Invalidate cache for the specific URL

    // Re-classify the page immediately to apply the consequences
    const result = await classify(tab.url, tab.title, tab.id);

    if (result.blockType === 'hard_block') {
        chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("blocked.html") });
    } else {
            // For any strike, we should provide immediate feedback.
            // The README says the "glass wall" is for DISTRACTING results.
            // We will apply it on strike, and include the updated count.
            chrome.tabs.sendMessage(tab.id, { type: "APPLY_GLASS_DOOR", strikeCount: newStrikeCount });    }
}

function getPageSnippet(tabId) {
    return new Promise(resolve => {
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (!settled) resolve('');
        }, 800);

        chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_SNIPPET" }, response => {
            settled = true;
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
                return resolve('');
            }
            resolve(response && response.snippet ? response.snippet : '');
        });
    });
}

function getUrlKey(urlObject) {
    return `${urlObject.origin}${urlObject.pathname}${urlObject.search}`;
}

async function isAllowedByUser(urlKey) {
    const { allowlistPaths = [], tempAllowPaths = [] } = await chrome.storage.local.get([
        "allowlistPaths",
        "tempAllowPaths"
    ]);

    if (allowlistPaths.includes(urlKey)) {
        return { allowed: true, reason: "permanent" };
    }

    const now = Date.now();
    const activeTemp = tempAllowPaths.filter(entry => entry.expiresAt > now);
    if (activeTemp.length !== tempAllowPaths.length) {
        await chrome.storage.local.set({ tempAllowPaths: activeTemp });
    }

    if (activeTemp.some(entry => entry.urlKey === urlKey)) {
        return { allowed: true, reason: "temporary" };
    }

    return { allowed: false, reason: "" };
}

const DEFAULT_BLACKLIST = ["instagram.com", "tiktok.com", "twitter.com", "facebook.com", "youtube.com/shorts", "iyf.tv"];

async function ensureDefaults() {
    const { blacklist = [] } = await chrome.storage.local.get("blacklist");
    const merged = Array.from(new Set([...blacklist, ...DEFAULT_BLACKLIST]));
    if (merged.length !== blacklist.length) {
        await chrome.storage.local.set({ blacklist: merged });
    }

    const { strikeCounts = {} } = await chrome.storage.local.get("strikeCounts");
    const { strikePatterns = [] } = await chrome.storage.local.get("strikePatterns");
    const { allowlistPaths = [] } = await chrome.storage.local.get("allowlistPaths");
    const { tempAllowPaths = [] } = await chrome.storage.local.get("tempAllowPaths");
    await chrome.storage.local.set({
        strikeCounts,
        strikePatterns,
        allowlistPaths,
        tempAllowPaths
    });
}

// On extension installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        monitoringState: true,
        blacklist: DEFAULT_BLACKLIST,
        strikeCounts: {},
        strikePatterns: [],
        allowlistPaths: [],
        tempAllowPaths: []
    });
    console.log("LockedIn Warden initialized.");
});

// On browser startup or service worker restart, ensure defaults exist
chrome.runtime.onStartup.addListener(() => {
    ensureDefaults().catch(e => console.warn("Could not ensure defaults:", e));
});

// Listen for messages from the Web App Hub (index.html)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    return handleUiMessage(request, sendResponse);
});

function handleUiMessage(request, sendResponse) {
    if (request.message === "GET_STRIKE_COUNTS") {
        chrome.storage.local.get("strikeCounts", (result) => {
            sendResponse({ success: true, strikeCounts: result.strikeCounts || {} });
        });
        return true; // Indicates async response
    }

    if (request.message === "GET_BLACKLIST") {
        chrome.storage.local.get("blacklist", (result) => {
            sendResponse({ success: true, blacklist: result.blacklist || [] });
        });
        return true; // Indicates async response
    }

    if (request.message === "ADD_TO_BLACKLIST") {
        chrome.storage.local.get("blacklist", (result) => {
            const currentBlacklist = result.blacklist || [];
            if (request.domain && !currentBlacklist.includes(request.domain)) {
                const updatedBlacklist = [...currentBlacklist, request.domain];
                chrome.storage.local.set({ blacklist: updatedBlacklist }).then(() => {
                    sendResponse({ success: true, blacklist: updatedBlacklist });
                });
            } else {
                sendResponse({ success: false, blacklist: currentBlacklist, error: "Domain already exists or is invalid." });
            }
        });
        return true; // Indicates async response
    }

    if (request.message === "REMOVE_FROM_BLACKLIST") {
        chrome.storage.local.get("blacklist", (result) => {
            let currentBlacklist = result.blacklist || [];
            if (request.domain) {
                const updatedBlacklist = currentBlacklist.filter(d => d !== request.domain);
                chrome.storage.local.set({ blacklist: updatedBlacklist }).then(() => {
                    sendResponse({ success: true, blacklist: updatedBlacklist });
                });
            } else {
                sendResponse({ success: false, blacklist: currentBlacklist, error: "Domain not provided." });
            }
        });
        return true; // Indicates async response
    }

    if (request.message === "START_WARDEN") {
        chrome.storage.local.set({ monitoringState: true }).then(() => {
            console.log("✅ Warden activated - monitoringState set to true");
            sendResponse({ success: true, monitoringState: true });

            // Inject flag button into all currently open tabs
            chrome.tabs.query({}, (tabs) => {
                console.log(`📊 Found ${tabs.length} open tabs`);
                tabs.forEach(tab => {
                    if (tab.id && tab.url && (tab.url.startsWith("http:") || tab.url.startsWith("https:"))) {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content.js']
                        }).then(() => {
                            chrome.tabs.sendMessage(tab.id, { type: "INJECT_FLAG_BUTTON" });
                        }).catch(e => {
                            console.warn(`Could not inject into tab ${tab.id}:`, e.message);
                        });
                    }
                });
            });
        }).catch(e => {
            console.error("Failed to activate Warden:", e);
            sendResponse({ success: false, error: e.message });
        });
        return true; // Indicates async response
    }

    if (request.message === "STOP_WARDEN") {
        (async () => {
            await chrome.storage.local.set({ monitoringState: false });
            // Remove flag button from all currently open tabs
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.id && tab.url && (tab.url.startsWith("http:") || tab.url.startsWith("https:"))) {
                        chrome.tabs.sendMessage(tab.id, { type: "REMOVE_FLAG_BUTTON" }).catch(e => {
                            console.warn(`Could not send REMOVE_FLAG_BUTTON to tab ${tab.id}:`, e);
                        });
                    }
                });
            });
            sendResponse({ success: true, monitoringState: false });
        })();
        return true; // Indicates async response
    }

    return false;
}

// ============================================
// Similarity Matching Helpers
// ============================================
function buildStrikePattern(urlObject) {
    const domain = urlObject.hostname.replace('www.', '');
    const pathParts = urlObject.pathname.split('/').filter(Boolean);
    const pathPrefix = `/${pathParts.slice(0, 2).join('/')}` || '/';
    const keywords = extractKeywordsFromPath(pathParts);

    return {
        domain,
        pathPrefix,
        keywords,
        lastSeenAt: Date.now()
    };
}

function mergeStrikePatterns(existing, incoming) {
    const merged = [...existing];
    const idx = merged.findIndex(p => p.domain === incoming.domain && p.pathPrefix === incoming.pathPrefix);
    if (idx >= 0) {
        const combinedKeywords = Array.from(new Set([...(merged[idx].keywords || []), ...(incoming.keywords || [])]));
        merged[idx] = {
            ...merged[idx],
            keywords: combinedKeywords,
            lastSeenAt: Date.now()
        };
    } else {
        merged.push(incoming);
    }
    return merged;
}

function isSimilarToStrikePattern(urlObject, patterns) {
    const domain = urlObject.hostname.replace('www.', '');
    const pathParts = urlObject.pathname.split('/').filter(Boolean);
    const pathPrefix = `/${pathParts.slice(0, 2).join('/')}` || '/';
    const keywords = extractKeywordsFromPath(pathParts);

    for (const pattern of patterns) {
        if (pattern.domain !== domain) continue;

        let signals = 0;
        let reason = '';

        if (pattern.pathPrefix && pathPrefix.startsWith(pattern.pathPrefix)) {
            signals += 1;
            reason = `path prefix ${pattern.pathPrefix}`;
        }

        const overlap = keywordOverlapCount(pattern.keywords || [], keywords);
        if (overlap > 0) {
            signals += 1;
            reason = reason ? `${reason} + keywords` : `keyword overlap`;
        }

        if (signals >= SIMILARITY_MATCH_THRESHOLD) {
            return { isSimilar: true, reason };
        }
    }

    return { isSimilar: false, reason: '' };
}

function extractKeywordsFromPath(pathParts) {
    const STOP = new Set(['watch', 'video', 'videos', 'post', 'posts', 'feed', 'home', 'index', 'v', 'p']);
    const keywords = [];
    for (const part of pathParts) {
        const cleaned = part.toLowerCase().replace(/[^a-z0-9-]/g, '');
        const split = cleaned.split('-').filter(Boolean);
        for (const word of split) {
            if (word.length < 3) continue;
            if (STOP.has(word)) continue;
            keywords.push(word);
        }
    }
    return Array.from(new Set(keywords));
}

function keywordOverlapCount(a, b) {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    let count = 0;
    for (const word of b) {
        if (setA.has(word)) count += 1;
    }
    return count;
}
