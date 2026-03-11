# Fuji X-E5 Research Agent

An AI agent that searches the web in real-time for Fujifilm X-E5 content — film simulation recipes, camera settings, iconic locations, and gear. Built with **Groq** (Llama 3.3 70B) + **Tavily** search + **Next.js** + **Vercel**.

## Stack (all free tiers)

| Tool | Purpose | Free tier |
|------|---------|-----------|
| [Groq](https://console.groq.com) | LLM (Llama 3.3 70B) | Generous free tier |
| [Tavily](https://app.tavily.com) | Web search API | 1,000 searches/month |
| [Vercel](https://vercel.com) | Hosting | Free hobby plan |
| [GitHub](https://github.com) | Code + auto-deploy | Free |

---

## Local Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/fuji-xe5-agent.git
cd fuji-xe5-agent
```

### 2. Install dependencies
```bash
npm install
```

### 3. Add your API keys
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
GROQ_API_KEY=your_groq_key_here
TAVILY_API_KEY=your_tavily_key_here
```

Get your keys:
- **Groq**: https://console.groq.com → API Keys
- **Tavily**: https://app.tavily.com → API Keys

### 4. Run locally
```bash
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel

### Option A: One-click via Vercel dashboard (easiest)

1. Push this repo to GitHub
2. Go to https://vercel.com/new
3. Import your GitHub repo
4. Add environment variables:
   - `GROQ_API_KEY`
   - `TAVILY_API_KEY`
5. Click **Deploy**

### Option B: Vercel CLI
```bash
npm i -g vercel
vercel
# Follow prompts, then add env vars in the Vercel dashboard
```

---

## Project Structure

```
fuji-xe5-agent/
├── app/
│   ├── api/
│   │   └── agent/
│   │       └── route.ts      # Agent loop: Tavily search → Groq LLM → stream
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx              # Main UI
├── components/
│   └── MessageRenderer.tsx   # Markdown renderer
├── .env.local.example        # Copy to .env.local and add your keys
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## How it works

1. User submits a question
2. The API route generates smart search queries based on the question
3. Tavily searches the web and returns real, current results
4. Search results are injected into the Groq prompt as context
5. Llama 3.3 70B synthesizes a structured answer
6. The response streams back to the UI in real-time

---

## Customization

- **Change the LLM model**: Edit `model` in `app/api/agent/route.ts` (Groq supports `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`, `gemma2-9b-it`)
- **Adjust search results**: Change `max_results` in the Tavily call
- **Modify the system prompt**: Edit `SYSTEM_PROMPT` in the route file
- **Add categories**: Edit `CATEGORIES` array in `app/page.tsx`
