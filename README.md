# Burp

A cheeky terminal RSS reader. Run `burp` and feast on your feeds.

## Features

- Interactive TUI with vim-style keyboard navigation
- Add and remove RSS/Atom feeds by URL
- Browse articles per feed or across all feeds, sorted by date
- Read/unread tracking — auto-marks read when you open an article
- Star articles for later
- Full-text article reading with HTML rendered as clean terminal text
- Full-text search across all articles (SQLite FTS5)
- Category/tag organisation for feeds
- OPML import (bulk add feeds from an export file)
- Open any article in your default browser
- Non-interactive CLI commands for scripting

## Installation

### Binary (recommended)

macOS and Linux — no dependencies required:

```sh
curl -fsSL https://raw.githubusercontent.com/mbensch/burp/main/scripts/install.sh | sh
```

Installs to `~/.local/bin/burp`. Override the location with `BURP_INSTALL_DIR`:

```sh
BURP_INSTALL_DIR=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/mbensch/burp/main/scripts/install.sh | sh
```

Or download the binary for your platform directly from the [latest release](https://github.com/mbensch/burp/releases/latest).

### From source

Requires [Bun](https://bun.sh).

```sh
git clone https://github.com/mbensch/burp.git
cd burp
bun install
bun run build    # compiles native binary to dist/burp
./dist/burp
```

## Usage

### Interactive TUI

```bash
burp
```

Launches the full terminal UI. Feeds are refreshed automatically on startup.

### Non-interactive commands

```bash
# Add a feed
burp add <url> [--category <name>]

# Import feeds from an OPML file
burp import <file.opml>

# Refresh all feeds and print new article counts
burp refresh

# List all feeds with unread counts
burp list
```

### Import OPML on launch

```bash
burp --import subscriptions.opml
```

## Keybindings

| Key | Action |
|-----|--------|
| `j` / `↓` | Navigate down |
| `k` / `↑` | Navigate up |
| `Enter` | Open selected feed / article |
| `q` / `Esc` | Back / quit |
| `a` | Add feed |
| `d` | Delete feed |
| `r` | Refresh feeds |
| `/` | Search |
| `s` | Star / unstar article |
| `m` | Toggle read / unread |
| `o` | Open article in browser |
| `i` | Import OPML (reminder — use `--import` flag on launch) |

## Data storage

The SQLite database is stored at `~/.config/burp/burp.db`. No cloud sync, no accounts — everything stays local.

## Development

```bash
bun install          # install dependencies
bun run dev          # run in dev mode (no build step)
bun run build        # compile native binary to dist/burp
bun run test         # run all tests
bun run test:watch   # watch mode
bun run lint         # Biome lint + format check
bun run lint:fix     # auto-fix formatting
```

## Project structure

```
src/
├── index.tsx              # CLI entry point and non-interactive commands
├── app.tsx                # Root Ink component, view router, keyboard handler
├── db/
│   ├── connection.ts      # Singleton DB connection (WAL mode, migrations on open)
│   ├── schema.ts          # Table definitions, FTS5 setup, migration runner
│   └── queries.ts         # All DB operations (typed)
├── services/
│   ├── feed.ts            # Fetch and parse RSS/Atom feeds via rss-parser
│   ├── opml.ts            # OPML XML import
│   └── search.ts          # FTS5 full-text search
├── views/
│   ├── FeedList.tsx       # Feed list with unread counts
│   ├── ArticleList.tsx    # Article list for a feed
│   ├── ArticleView.tsx    # Full article reading view
│   ├── AddFeed.tsx        # Add feed form
│   └── Search.tsx         # Search input and results
└── components/
    ├── StatusBar.tsx      # Context-aware keybinding hints
    └── Tag.tsx            # Category badge
```

## License

MIT
