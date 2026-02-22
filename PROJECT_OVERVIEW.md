# CLI RSS Reader — Project Overview

## Tech Stack
- **Runtime:** Node.js + TypeScript
- **TUI Framework:** Ink (React for CLI) + ink-text-input, ink-select-input
- **Database:** SQLite via `better-sqlite3`
- **RSS Parsing:** `rss-parser`
- **HTML-to-text:** `html-to-text` (for rendering article content in terminal)
- **OPML Import:** manual XML parsing
- **Build:** `tsup` for bundling, `tsx` for dev

## Project Structure
```
cli-rss-reader/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.tsx          # Entry point, CLI arg parsing
│   ├── app.tsx            # Root Ink component, routing between views
│   ├── db/
│   │   ├── schema.ts      # SQLite table definitions + migrations
│   │   └── queries.ts     # All DB operations (feeds, articles, tags)
│   ├── services/
│   │   ├── feed.ts        # Fetch & parse RSS feeds
│   │   ├── opml.ts        # OPML import
│   │   └── search.ts      # Full-text search over articles
│   ├── views/
│   │   ├── FeedList.tsx    # List of subscribed feeds with unread counts
│   │   ├── ArticleList.tsx # Articles for selected feed/category
│   │   ├── ArticleView.tsx # Full-text reading view
│   │   ├── AddFeed.tsx     # Add feed by URL
│   │   └── Search.tsx      # Search articles
│   └── components/
│       ├── StatusBar.tsx   # Bottom bar with keybindings hint
│       └── Tag.tsx         # Category/tag badge
```

## Database Schema (SQLite)

- **feeds**: id, url, title, description, site_url, category, created_at, last_fetched_at
- **articles**: id, feed_id (FK), guid, title, link, content, summary, author, published_at, is_read, is_starred, created_at
- **tags**: id, name
- **article_tags**: article_id, tag_id
- FTS5 virtual table on articles(title, content) for full-text search

## Key Features

1. **Feed management**: Add/remove feeds by URL, assign categories, list all feeds with unread counts
2. **OPML import**: Import feeds from `.opml` files
3. **Article browsing**: Navigate articles per feed or "all", sorted by date
4. **Read/unread tracking**: Auto-mark read on open, bulk mark-read per feed
5. **Starring/bookmarks**: Star articles for later
6. **Full-text reading**: Render article HTML as formatted terminal text
7. **Search**: Full-text search across all articles using SQLite FTS5
8. **Categories/tags**: Organize feeds into categories, filter by category
9. **Keyboard navigation**: vim-style keys (j/k, enter, q/esc, /, s for star, etc.)
10. **Auto-refresh**: Fetch new articles on launch, manual refresh with `r`
11. **Open in browser**: Press `o` to open article link in default browser

## UI Flow

```
Feed List → Article List → Article View
   ↕              ↕
Add Feed       Search
```

## Keybindings

| Key     | Action               |
|---------|----------------------|
| j/k or ↑/↓ | Navigate        |
| Enter   | Select/Open          |
| q/Esc   | Back/Quit            |
| a       | Add feed             |
| d       | Delete feed          |
| r       | Refresh feeds        |
| /       | Search               |
| s       | Star/unstar          |
| m       | Toggle read/unread   |
| o       | Open in browser      |
| i       | Import OPML          |
| Tab     | Switch between feeds/categories |

## CLI Interface

```bash
# Launch TUI
rss

# Non-interactive commands
rss add <url> [--category <name>]
rss import <file.opml>
rss refresh
rss list
```

Entry point via `bin` field in `package.json` pointing to bundled output.
