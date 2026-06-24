# Academic Paper Reviewer — Professor Meridian

A local web app that reviews research papers, theses, and capstone documents using **Google Gemini** or **Groq**. It acts as a rigorous-but-supportive academic advisor — giving structured critique, actionable revision suggestions, and follow-up chat strictly limited to scholarly writing.

Upload a paper, get a section-by-section review, then keep chatting with "Professor Meridian" about the feedback. Optionally add Google Drive reference material, a consultation journal from other advisors, and a research questionnaire for alignment checks.

---

## Features

- Upload **PDF, DOCX, TXT, or Markdown** files (up to 50 MB)
- **Gemini + Groq** support with an **Auto** mode (Gemini preferred for long papers, Groq as fast fallback)
- Structured feedback: overall assessment, strengths, areas for improvement, numbered revisions, citations, and advisor questions
- **Talk with Professor Meridian** — chat that keeps your paper and review in context
- Adjustable **review depth** (overview / detailed / revision-focused) and **questioning mode** (light / balanced / proactive Socratic)
- Optional **Google Drive reference** link, **consultation journal**, and **research questionnaire** assessment
- API keys stay in your browser or in a local `.env` file — nothing is stored on a server

---

## Requirements

| Requirement | Details |
|-------------|---------|
| **Python** | 3.10 or newer (3.11+ recommended) |
| **pip** | Comes with Python; used to install dependencies |
| **OS** | Windows, macOS, or Linux |
| **API key** | A free **Gemini** key (recommended) and/or a **Groq** key |
| **Internet** | Required — documents are sent to Gemini/Groq for analysis |

Python dependencies (installed via `requirements.txt`):

```text
fastapi          # web framework
uvicorn          # ASGI server
python-multipart # file uploads
groq             # Groq API client
google-genai     # Gemini API client
pypdf            # PDF text extraction
python-docx      # DOCX text extraction
python-dotenv    # loads .env files
markdown, httpx  # rendering + HTTP requests
```

---

## Installation

### 1. Download the project

**Easiest way (no Git needed):**

1. Go to **[the repository page](https://github.com/DanielTala1/academic-paper-reviewer)**.
2. Click the green **`< > Code`** button → **Download ZIP**.
3. **Unzip** the downloaded file to a folder you can find easily (e.g. your Desktop).

**Or, if you have Git installed:**

```bash
git clone https://github.com/DanielTala1/academic-paper-reviewer.git
```

### 2. Open a console (terminal) in the project folder

A "console" (also called a terminal or command prompt) is where you type the commands in the next steps. Open it **inside the unzipped project folder**:

**Windows:**

1. Open the project folder in **File Explorer**.
2. Click the **address bar** at the top (the box showing the folder path).
3. Type `cmd` and press **Enter** — a black console window opens already pointing at the folder.

> Alternative: hold **Shift**, right-click an empty area inside the folder, and choose **"Open PowerShell window here"** or **"Open in Terminal"**.

**macOS:**

1. Open the project folder in **Finder**.
2. Right-click the folder → **Services** → **New Terminal at Folder**.

> If you don't see that option, open **Terminal** from Applications → Utilities, type `cd ` (with a space), drag the folder into the window, and press **Enter**.

> **Tip:** To check you're in the right place, the console should show the project folder name (e.g. `academic-paper-reviewer`) in its path.

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Get your API keys (free)

| Provider | Get a key | Best for |
|----------|-----------|----------|
| **Gemini** (recommended) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Long theses and full papers |
| **Groq** (optional backup) | [console.groq.com/keys](https://console.groq.com/keys) | Fast, short reviews |

You can paste the keys directly into the web UI, **or** create a `.env` file so they load automatically. Copy the example and fill in your keys:

```bash
# Windows
copy .env.example .env
# macOS / Linux
cp .env.example .env
```

```env
GEMINI_API_KEY=AIza...
GROQ_API_KEY=gsk_...
```

> The `.env` file is git-ignored, so your keys never get committed.

### 5. Run the server

**Windows:** double-click `start.bat`, **or** run any platform:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Then open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

---

## How to Use

1. **Choose an AI provider** — leave it on **Auto** (default) to use Gemini first with Groq as a fallback.
2. **Enter your API key(s)** in the UI (skip this if you set them in `.env`).
3. **Upload your document** (PDF, DOCX, TXT, or MD).
4. **Pick your options:**
   - **Review depth** — *Quick overview*, *Detailed* (section-by-section), or *Revision-focused*.
   - **Questioning mode** — *Light*, *Balanced*, or *Proactive (Socratic)* for a mock-defense style.
   - **Focus areas** (optional) — e.g. "methodology and citations".
5. Click **Review my paper** to generate the structured feedback.
6. **Chat with Professor Meridian** below the review to ask follow-up questions, defend claims, or request rewrites — your paper and review stay in context.

### Optional add-ons

- **Google Drive reference** — paste a shareable Drive/Docs link (set to *Anyone with the link can view*) to give the advisor extra context.
- **Consultation journal** — upload notes from meetings with other professors so feedback builds on prior advice instead of repeating it.
- **Research questionnaire** — upload a survey instrument to check whether its items support the paper's main argument (requires the paper to be uploaded too).

---

## Gemini vs Groq — which should I use?

| | **Gemini** (recommended) | **Groq** |
|---|--------------------------|----------|
| **Free tier** | Yes — no credit card | Yes |
| **Long papers / theses** | ✅ ~120k characters | ❌ ~8k characters on free tier |
| **Speed** | Good | Very fast |
| **Auto mode in this app** | **Used first** | Fallback if Gemini fails |

**For thesis/capstone work, Gemini is the better choice** because Groq's free tier caps each request at roughly 12,000 tokens (~4–8 pages), while Gemini handles much longer documents on its free tier.

### "Rate limit reached" — what to do

Free tiers limit how much text you can send per minute and per day. This app already helps in two ways automatically:

- **Automatic text compression** — before sending, the app strips token-wasting noise from your document (repeated page headers/footers, page numbers, hyphenated line breaks, and extra whitespace). For long theses this can cut the size sent to the AI by 10–30%, so big papers are far less likely to hit the limit.
- **Automatic retry** — if a brief per-minute rate limit is hit, the app waits a few seconds and retries on its own.

If you still see the message:

1. **Wait about a minute** and try again (per-minute limits reset quickly).
2. Use **Quick overview** depth, or review **one chapter at a time** instead of the whole thesis at once.
3. Make sure you're on **Gemini** (Auto mode uses it first) — it allows much larger documents than Groq's free tier.
4. Add a **Groq** key as well so Auto mode can fall back to it when Gemini is busy.
5. If you use **Groq only**, upgrade to the [Groq Dev tier](https://console.groq.com/settings/billing) and set `GROQ_TIER=dev` in `.env`.

---

## Configuration (optional)

Advanced settings can be tuned via environment variables in `.env`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_PROVIDER` | `auto` | `auto`, `gemini`, or `groq` |
| `GEMINI_REVIEW_MODEL` | `gemini-2.0-flash` | Gemini model name |
| `GROQ_REVIEW_MODEL` | `llama-3.3-70b-versatile` | Groq model name |
| `GROQ_TIER` | `free` | Set to `dev`/`paid` to unlock larger limits |
| `RATE_LIMIT_RETRIES` | `2` | How many times to auto-retry after a rate-limit error |
| `RATE_LIMIT_BACKOFF_SECONDS` | `6` | Initial wait before retrying (doubles each attempt) |

---

## Supported formats

| Format | Notes |
|--------|-------|
| PDF | Text-based PDFs work best (scanned image PDFs won't extract) |
| DOCX | Full paragraph and table support |
| TXT / MD | Plain text |

---

## Project structure

```text
.
├── main.py            # FastAPI app, routes, document parsing, prompt building
├── llm_providers.py   # Gemini + Groq clients, limits, auto-fallback logic
├── requirements.txt   # Python dependencies
├── start.bat          # Windows one-click launcher
├── .env.example       # Template for API keys / config
└── static/            # Front-end (index.html, app.js, styles.css)
```

---

## Privacy note

Uploaded documents are sent to **Google (Gemini)** or **Groq** for analysis, subject to their terms. Do not upload confidential or embargoed work unless you accept that. Everything else — the web server, file parsing, and your API keys — runs locally on your machine.

---

## License

Released under the [MIT License](LICENSE).
