import { render } from "ink";
import React from "react";
import { App } from "./app";
import { getDb } from "./db/connection";
import { addFeed, listFeeds, markAllArticlesRead } from "./db/queries";
import { fetchAndParseFeed, refreshAllFeeds } from "./services/feed";
import { importOpml } from "./services/opml";

const args = process.argv.slice(2);
const command = args[0];

async function runCli() {
  const db = getDb();

  // ── Non-interactive commands ──────────────────────────────────────────────
  if (command === "add") {
    const url = args[1];
    const categoryIdx = args.indexOf("--category");
    const category = categoryIdx !== -1 ? (args[categoryIdx + 1] ?? "") : "";

    if (!url) {
      console.error("Usage: burp add <url> [--category <name>]");
      process.exit(1);
    }
    try {
      const parsed = await fetchAndParseFeed(url);
      addFeed(db, {
        url,
        title: parsed.title,
        description: parsed.description,
        site_url: parsed.site_url,
        category,
      });
      console.log(`Added: ${parsed.title || url}`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
    return;
  }

  if (command === "import") {
    const filePath = args[1];
    if (!filePath) {
      console.error("Usage: burp import <file.opml>");
      process.exit(1);
    }
    try {
      const result = await importOpml(db, filePath);
      console.log(`Imported: ${result.added} added, ${result.skipped} skipped`);
      if (result.errors.length > 0) {
        for (const e of result.errors) console.warn(`  Warning: ${e}`);
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
    return;
  }

  if (command === "refresh") {
    const results = await refreshAllFeeds(db);
    const total = results.reduce((n, r) => n + r.added, 0);
    console.log(`Refreshed ${results.length} feeds, ${total} new articles`);
    return;
  }

  if (command === "list") {
    const feeds = listFeeds(db);
    if (feeds.length === 0) {
      console.log("No feeds. Use: burp add <url>");
      return;
    }
    for (const feed of feeds) {
      const unread = feed.unread_count > 0 ? ` (${feed.unread_count} unread)` : "";
      console.log(`${feed.title || feed.url}${unread}`);
    }
    return;
  }

  if (command === "mark-read") {
    const feedId = Number(args[1]);
    if (feedId) {
      markAllArticlesRead(db, feedId);
      console.log(`Marked all articles in feed ${feedId} as read`);
    } else {
      console.error("Usage: burp mark-read <feedId>");
      process.exit(1);
    }
    return;
  }

  // ── Interactive TUI ───────────────────────────────────────────────────────
  const importIdx = args.indexOf("--import");
  const initialOpmlPath = importIdx !== -1 ? args[importIdx + 1] : undefined;

  const { waitUntilExit } = render(<App db={db} initialOpmlPath={initialOpmlPath} />, {
    exitOnCtrlC: true,
  });

  await waitUntilExit();
}

runCli().catch((err) => {
  console.error(err);
  process.exit(1);
});
