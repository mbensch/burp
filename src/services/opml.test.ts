import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "../db/schema";
import { importOpml } from "./opml";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function writeTempOpml(content: string): Promise<string> {
  const filePath = path.join(os.tmpdir(), `opml-test-${Date.now()}-${Math.random()}.opml`);
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

const FLAT_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>My Feeds</title></head>
  <body>
    <outline text="Hacker News" type="rss" xmlUrl="https://news.ycombinator.com/rss" />
    <outline text="The Verge" type="rss" xmlUrl="https://www.theverge.com/rss/index.xml" />
  </body>
</opml>`;

const CATEGORIZED_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>My Feeds</title></head>
  <body>
    <outline text="Tech">
      <outline text="Hacker News" type="rss" xmlUrl="https://news.ycombinator.com/rss" />
      <outline text="The Verge" type="rss" xmlUrl="https://www.theverge.com/rss/index.xml" />
    </outline>
    <outline text="Science">
      <outline text="NASA" type="rss" xmlUrl="https://www.nasa.gov/rss/dyn/breaking_news.rss" />
    </outline>
  </body>
</opml>`;

const NO_XMLURL_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>My Feeds</title></head>
  <body>
    <outline text="Just a label, no xmlUrl" />
    <outline text="Valid Feed" type="rss" xmlUrl="https://example.com/feed.xml" />
  </body>
</opml>`;

// ─── Setup ────────────────────────────────────────────────────────────────────

let db: Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("importOpml", () => {
  it("adds all feeds from a flat OPML file", async () => {
    const filePath = await writeTempOpml(FLAT_OPML);
    const result = await importOpml(db, filePath);

    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const feeds = db.prepare("SELECT * FROM feeds ORDER BY url").all() as { url: string }[];
    expect(feeds).toHaveLength(2);
    expect(feeds.map((f) => f.url)).toContain("https://news.ycombinator.com/rss");
    expect(feeds.map((f) => f.url)).toContain("https://www.theverge.com/rss/index.xml");
  });

  it("assigns correct category for feeds nested under a category outline", async () => {
    const filePath = await writeTempOpml(CATEGORIZED_OPML);
    const result = await importOpml(db, filePath);

    expect(result.added).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const techFeeds = db
      .prepare("SELECT * FROM feeds WHERE category = 'Tech' ORDER BY url")
      .all() as { url: string; category: string }[];
    expect(techFeeds).toHaveLength(2);

    const scienceFeeds = db.prepare("SELECT * FROM feeds WHERE category = 'Science'").all() as {
      url: string;
      category: string;
    }[];
    expect(scienceFeeds).toHaveLength(1);
    expect(scienceFeeds[0].url).toBe("https://www.nasa.gov/rss/dyn/breaking_news.rss");
  });

  it("counts feeds as skipped when re-importing the same OPML", async () => {
    const filePath = await writeTempOpml(FLAT_OPML);

    const firstImport = await importOpml(db, filePath);
    expect(firstImport.added).toBe(2);
    expect(firstImport.skipped).toBe(0);

    const secondImport = await importOpml(db, filePath);
    expect(secondImport.added).toBe(0);
    expect(secondImport.skipped).toBe(2);
    expect(secondImport.errors).toHaveLength(0);

    // Still only 2 feeds in the DB
    const count = (db.prepare("SELECT COUNT(*) as c FROM feeds").get() as { c: number }).c;
    expect(count).toBe(2);
  });

  it("throws a clear error for a non-existent file", async () => {
    await expect(importOpml(db, "/tmp/does-not-exist-opml-test.opml")).rejects.toThrow(
      /Failed to read OPML file/,
    );
  });

  it("throws a clear error for a file with no <opml> tag", async () => {
    const filePath = await writeTempOpml("<html><body>Not OPML</body></html>");
    await expect(importOpml(db, filePath)).rejects.toThrow(
      /does not appear to be a valid OPML document/,
    );
  });

  it("silently skips outline elements that are missing xmlUrl", async () => {
    const filePath = await writeTempOpml(NO_XMLURL_OPML);
    const result = await importOpml(db, filePath);

    // Only the valid feed should be added; label-only outline is silently ignored
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const feeds = db.prepare("SELECT * FROM feeds").all() as { url: string }[];
    expect(feeds).toHaveLength(1);
    expect(feeds[0].url).toBe("https://example.com/feed.xml");
  });
});
