
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();
const path = require('path'); // Import path module

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY is not set. Please set it in your .env file.');
}

const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const model = genAI.getGenerativeModel({ model: MODEL_NAME });
const EXTENSION_SHARED_SECRET = process.env.EXTENSION_SHARED_SECRET || '';

let proctoringChat; // To hold the Gemini chat session

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shouldRetry = (err) => {
  const status = err?.status || err?.statusCode;
  return status >= 500 || status === 429;
};

const PROCTORING_PROMPT = `
You are a world-class Productivity Scientist and Behavioral Analysis AI.

Your role is to monitor a user's work session via video and audio
and determine whether the user is focused or distracted.

You analyze observable behavior only, including:
- Gaze direction and attention to screen
- Posture and body movement
- Phone usage or off-screen interaction
- Sustained talking or multitasking behavior

You do NOT perform identity recognition.
You do NOT infer sensitive personal traits.
You do NOT store memory across sessions.

--------------------------------------------------
ANALYSIS MODES
--------------------------------------------------

You operate in two internal analysis cadences:

1. CONTINUOUS OBSERVATION (internal only)
- Continuously observe video and audio streams
- Track behavioral signals related to focus and engagement
- Do not produce output during this phase

2. HEARTBEAT ANALYSIS (every ~60 seconds)
- Summarize the last 60 seconds of observed behavior
- Decide whether the user was distracted during this window

--------------------------------------------------
HEARTBEAT OUTPUT (MANDATORY)
--------------------------------------------------

For each heartbeat, output a JSON object **and nothing else**:

{
  "isDistracted": boolean,
  "feedback": "string"
}

Rules for feedback:
- If isDistracted = true:
  - feedback must be a sarcastic but polite and humorous roast
  - tone should be playful, not insulting or hostile
  - keep it to 1–2 short sentences
- If isDistracted = false:
  - feedback must be short and encouraging
  - neutral, supportive tone

--------------------------------------------------
INTERNAL SIGNAL GUIDANCE (NON-OUTPUT)
--------------------------------------------------

You may internally reason about:
- Engagement level
- Stress level
- Emotional cues
- Primary observed actions

These signals are used ONLY to inform the distraction decision.
They must NOT appear in the final output unless requested.

--------------------------------------------------
BEHAVIOR RULES
--------------------------------------------------
- Stay silent except when a heartbeat output is requested
- Base decisions on sustained patterns, not brief movements
- Favor false negatives over false positives
- When uncertain, default to "not distracted"

--------------------------------------------------
CONSTRAINTS
--------------------------------------------------
- Do not change output format
- Do not add extra fields
- Do not explain your reasoning
- Do not address the user directly outside of the feedback string

The application will provide video/audio input labeled
"User's Work Session" for each heartbeat window.
`;

app.post('/api/proctoring-chat', async (req, res) => {
  const { type, parts } = req.body;

  try {
    if (type === 'start') {
      proctoringChat = model.startChat({
        history: [{
          role: 'user',
          parts: [{ text: PROCTORING_PROMPT }]
        }],
        enableAutomaticRTF: true,
      });
      res.json({ message: 'Proctoring chat session started.' });
    } else if (type === 'message') {
      if (!proctoringChat) {
        return res.status(400).json({ error: 'Proctoring chat session not active.' });
      }
      let lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await proctoringChat.sendMessage(parts);
          const response = await result.response;
          const text = response.text();
          return res.json({ text });
        } catch (err) {
          lastError = err;
          if (!shouldRetry(err) || attempt === 2) break;
          await sleep(500 * (attempt + 1));
        }
      }
      throw lastError;
    } else {
      res.status(400).json({ error: 'Invalid request type.' });
    }
  } catch (error) {
    console.error('Error in proctoring chat:', error);
    res.status(500).json({ error: 'Error in proctoring chat.' });
  }
});

const normalizeClassification = (text) => {
  const upper = (text || '').toUpperCase();
  if (upper.includes('DISTRACT')) return 'DISTRACTING';
  if (upper.includes('CONDUCIVE') || upper.includes('CON')) return 'CONDUCIVE';
  if (upper.includes('MIXED')) return 'MIXED';
  return 'MIXED';
};

app.post('/api/classify-tab', async (req, res) => {
  const { url, title, pageSnippet } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'Missing url.' });
  }

  if (EXTENSION_SHARED_SECRET) {
    const provided = req.get('x-extension-secret');
    if (provided !== EXTENSION_SHARED_SECRET) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
  }

  const safeTitle = (title || '').slice(0, 200);
  const safeSnippet = (pageSnippet || '').slice(0, 1200);
  const prompt = `
You are a strict classifier for productivity and focus.

Given a URL, page title, and optional page snippet, classify the page as:
- CONDUCIVE (supports focused work)
- DISTRACTING (likely to distract)
- MIXED (unclear or neutral)

Return ONLY one of: CONDUCIVE, DISTRACTING, MIXED.

URL: ${url}
Title: ${safeTitle}
Snippet: ${safeSnippet}
`;

  try {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const classification = normalizeClassification(text);
        return res.json({
          classification,
          source: 'ai',
          blockType: classification === 'DISTRACTING' ? 'glass_wall' : 'none',
        });
      } catch (err) {
        lastError = err;
        if (!shouldRetry(err) || attempt === 2) break;
        await sleep(500 * (attempt + 1));
      }
    }
    throw lastError;
  } catch (error) {
    console.error('Error in classify-tab:', error);
    res.status(500).json({ error: 'Error in classify-tab.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'public')));

// All other GET requests not handled by API will return your React app
// Express 5 + path-to-regexp v6: use a RegExp catch-all instead of "*".
app.get(/.*/, (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});


app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
