import { readFile } from "node:fs/promises";
import type Database from "better-sqlite3";
import { addFeed, getFeedByUrl } from "../db/queries";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  added: number;
  skipped: number;
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAttribute(tag: string, name: string): string | null {
  const re = new RegExp(`${name}=["']([^"']*)["']`, "i");
  const m = re.exec(tag);
  return m ? m[1] : null;
}

interface FeedEntry {
  url: string;
  title: string;
  category: string;
}

function parseOpmlFeeds(xml: string): FeedEntry[] {
  const results: FeedEntry[] = [];
  const categoryStack: string[] = [];

  // Match closing </outline> tags and opening/self-closing <outline ...> tags
  const tokenRe = /(<\/outline>|<outline\b[^>]*\/?>)/gi;

  for (;;) {
    const match = tokenRe.exec(xml);
    if (match === null) break;
    const token = match[1];

    if (/^<\/outline>/i.test(token)) {
      categoryStack.pop();
      continue;
    }

    const isSelfClosing = token.trimEnd().endsWith("/>");
    const xmlUrl = getAttribute(token, "xmlUrl");
    const text = getAttribute(token, "text") ?? getAttribute(token, "title") ?? "";

    if (xmlUrl) {
      const category = categoryStack[categoryStack.length - 1] ?? "";
      results.push({ url: xmlUrl, title: text, category });
      // Feed outlines with xmlUrl are treated as leaves even if not self-closing
    } else if (!isSelfClosing) {
      // Category outline: opening tag without xmlUrl — push to stack
      categoryStack.push(text);
    }
    // Self-closing without xmlUrl: silently skip
  }

  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function importOpml(db: Database.Database, filePath: string): Promise<ImportResult> {
  let xml: string;

  try {
    xml = await readFile(filePath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read OPML file "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!/<opml\b/i.test(xml)) {
    throw new Error(
      `File "${filePath}" does not appear to be a valid OPML document (missing <opml> tag).`,
    );
  }

  const feeds = parseOpmlFeeds(xml);

  const result: ImportResult = { added: 0, skipped: 0, errors: [] };

  for (const feed of feeds) {
    try {
      const existing = getFeedByUrl(db, feed.url);
      if (existing) {
        result.skipped++;
      } else {
        addFeed(db, {
          url: feed.url,
          title: feed.title,
          description: "",
          site_url: "",
          category: feed.category,
        });
        result.added++;
      }
    } catch (err) {
      result.errors.push(
        `Error importing feed "${feed.url}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
