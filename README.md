<p align="center">
  <img src="https://img.shields.io/badge/D%C3%A9j%C3%A0_Claude-E87B35?style=for-the-badge&logoColor=white&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIxIDE1YTIgMiAwIDAgMS0yIDJIN2wtNCA0VjVhMiAyIDAgMCAxIDItMmgxNGEyIDIgMiAwIDEgMiAyeiI+PC9wYXRoPjwvc3ZnPg==" alt="Déjà Claude" height="40">
</p>

<h1 align="center">Déjà Claude</h1>

<p align="center">
  <strong>"I know I asked Claude about this before..."</strong>
  <br>
  <em>Stop digging through files. Find any conversation in seconds.</em>
</p>

<p align="center">
  <a href="#-the-problem">The Problem</a> •
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-screenshots">Screenshots</a> •
  <a href="#-how-it-works">How It Works</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Tailwind-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="MIT License">
</p>

---

## 😤 The Problem

You've been using **Claude Code** for weeks. Hundreds of conversations. Thousands of brilliant solutions.

Now you need to find that *one* session where Claude helped you:
- Set up that authentication flow
- Write that perfect regex pattern
- Debug that database migration
- Explain that complex algorithm

**Your options today:**

| What You Do | How It Feels |
|-------------|--------------|
| 📁 Browse `~/.claude/projects/` | *"Which folder was it again..."* |
| 📜 Open random `.jsonl` files | *"This isn't it... this isn't it either..."* |
| 🔍 `grep` through JSON blobs | *"I can't read any of this"* |
| 😩 Ask Claude again | *"Didn't we already solve this?"* |

---

## ✨ The Solution

**Déjà Claude** — A beautiful interface to search, browse, and export your Claude Code history.

```
╭─────────────────────────────────────────────────────────────────────╮
│  🔍 authentication jwt token                                        │
├────────────────────────┬────────────────────────────────────────────┤
│                        │                                            │
│  📁 PROJECTS           │  💬 API Authentication Setup               │
│  ──────────────        │  Dec 15, 2024 • 47 messages                │
│                        │                                            │
│  /home/dev/myapp  (12) │  ┌─────────────────────────────────────┐   │
│  /home/dev/api    (8)  │  │ You                        2:34 PM  │   │
│                        │  │ How do I implement JWT auth with... │   │
│  🔎 SEARCH RESULTS     │  └─────────────────────────────────────┘   │
│  ──────────────        │                                            │
│  3 sessions found      │  ┌─────────────────────────────────────┐   │
│                        │  │ Claude                     2:34 PM  │   │
│  ▸ API Authentication  │  │ I'll help you implement secure JWT  │   │
│    ├─ [You] "...jwt    │  │ authentication. Let's start with... │   │
│    │   token valid..." │  │                                     │   │
│    └─ [Claude] "...the │  │ [Match] "...the authentication      │   │
│        auth flow..."   │  │          flow validates tokens..."  │   │
│                        │  └─────────────────────────────────────┘   │
│                        │                                            │
│                        │                    [📥 Export Markdown]    │
╰────────────────────────┴────────────────────────────────────────────╯
```

---

## 🚀 Features

### 🔍 Instant Full-Text Search
Search across **all** your Claude sessions simultaneously. Results show context previews so you know exactly what you're clicking.

### 📍 Jump to Exact Match
Click a search result → land directly on that message. No more scrolling through 500-message sessions hunting for one line.

### 🎯 Smart Noise Filtering
Automatically hides:
- Warmup sessions (`"warmup"`, `"test"`, `"hi"`)
- Sessions with only 1-2 messages
- Empty or trivial conversations

**See only the conversations that matter.**

### 🖍️ Search Highlighting
- **Yellow highlight** on matching text
- **Orange border** on messages containing matches
- **"Match" badge** for quick visual scanning
- **Animated ring** when jumping to a message

### 💾 One-Click Export
Export any session as clean, formatted Markdown. Perfect for:
- Documentation
- Sharing solutions with teammates
- Archiving important conversations

### 🌙 Native Dark Theme
Claude-inspired design that's easy on the eyes at 2 AM.

### ⚡ Zero Configuration
Just run it. Déjà Claude finds your history at `~/.claude/projects/` automatically.

---

## 🏃 Quick Start

```bash
# Clone the repo
git clone https://github.com/yourusername/deja-claude.git
cd deja-claude

# Install dependencies
npm install

# Launch
npm run dev
```

Open **http://localhost:5173** — start searching!

---

## 📸 Screenshots

<details>
<summary><b>🖼️ Project Browser</b></summary>
<br>
Browse all your Claude projects sorted by recent activity. Session counts show only meaningful conversations.
</details>

<details>
<summary><b>🔍 Search with Context Previews</b></summary>
<br>
Search results show match previews with surrounding context. Click any preview to jump directly to that message.
</details>

<details>
<summary><b>💬 Message Viewer with Highlights</b></summary>
<br>
Search terms highlighted in yellow. Matching messages marked with orange left border and "Match" badge.
</details>

<details>
<summary><b>🛠️ Tool Call Details</b></summary>
<br>
Expandable sections show exactly what tools Claude used and their inputs.
</details>

---

## ⚙️ How It Works

Déjà Claude reads your existing Claude Code history. **It never modifies anything** — purely read-only.

```
~/.claude/projects/
├── -home-user-myproject/          # URL-encoded project paths
│   ├── session-abc123.jsonl       # Conversation logs
│   ├── session-def456.jsonl
│   └── ...
└── -home-user-another/
    └── ...
```

The JSONL files contain your full conversation history. Déjà Claude parses them into a searchable, browsable interface.

---

## 🏗️ Architecture

```
deja-claude/
├── backend/                 # Node.js + Express
│   └── src/
│       ├── server.ts       # HTTP server & API routes
│       └── history.ts      # JSONL parser & search engine
│
├── frontend/               # React + Vite + Tailwind
│   └── src/
│       └── App.tsx         # Main application
│
└── package.json            # Monorepo workspace root
```

| Layer | Tech | Purpose |
|-------|------|---------|
| **API** | Express | REST endpoints for projects, sessions, search |
| **Parser** | Custom | JSONL parsing, content extraction, deduplication |
| **Search** | In-memory | Full-text search with match context extraction |
| **UI** | React + Tailwind | Responsive dark-themed interface |

---

## 📋 Requirements

- **Node.js** 18+
- **Claude Code CLI** with existing conversation history
- A modern browser

---

## 🛠️ Development

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The dev server runs:
- **Frontend**: http://localhost:5173 (Vite)
- **Backend**: http://localhost:3001 (Express)

---

## 🗺️ Roadmap

- [ ] **Session Resume** — Jump back into any session from the viewer
- [ ] **Date Filters** — Filter by date range
- [ ] **Statistics** — Usage patterns and insights
- [ ] **Bookmarks** — Save important sessions
- [ ] **Full-text Index** — SQLite FTS for instant search at scale
- [ ] **Keyboard Navigation** — Vim-style shortcuts

---

## 🤔 Why "Déjà Claude"?

**Déjà vu** (French: *"already seen"*) — that eerie feeling you've experienced something before.

**Déjà Claude** — that *certain* feeling you've asked Claude about this before... and now you can finally find it.

---

## 🤝 Contributing

Contributions welcome! Feel free to:
- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Submit PRs

---

## 📄 License

MIT License — do whatever you want with it.

---

<p align="center">
  <strong>Built for Claude Code power users who refuse to lose their conversation history.</strong>
  <br><br>
  <em>Stop searching. Start finding.</em>
  <br><br>
  ⭐ <a href="../../stargazers">Star this repo</a> if Déjà Claude saved you time!
</p>
