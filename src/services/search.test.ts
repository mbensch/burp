import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addFeed, upsertArticle } from "../db/queries";
import { runMigrations } from "../db/schema";
import { searchArticles } from "./search";

let db: Database.Database;

function seedFeed(overrides: Partial<Parameters<typeof addFeed>[1]> = {}) {
  return addFeed(db, {
    url: "https://example.com/feed",
    title: "Example Feed",
    description: "A test feed",
    site_url: "https://example.com",
    category: "tech",
    ...overrides,
  });
}

function seedArticle(feedId: number, overrides: Partial<Parameters<typeof upsertArticle>[1]> = {}) {
  return upsertArticle(db, {
    feed_id: feedId,
    guid: `guid-${Math.random()}`,
    title: "Test Article",
    link: "https://example.com/article",
    content: "Full content here",
    summary: "Summary here",
    author: "Author",
    published_at: Math.floor(Date.now() / 1000),
    ...overrides,
  });
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("searchArticles", () => {
  it("returns an article whose title matches the query", () => {
    const feed = seedFeed();
    seedArticle(feed.id, {
      guid: "g1",
      title: "Introduction to Vitest",
      content: "Some unrelated content",
    });

    const results = searchArticles(db, "Vitest");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Introduction to Vitest");
  });

  it("returns an article whose content matches the query", () => {
    const feed = seedFeed();
    seedArticle(feed.id, {
      guid: "g1",
      title: "Generic Title",
      content: "SQLite full-text search is powerful",
    });

    const results = searchArticles(db, "powerful");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Generic Title");
  });

  it("returns an empty array when no articles match", () => {
    const feed = seedFeed();
    seedArticle(feed.id, { guid: "g1", title: "Hello World", content: "Basic content" });

    const results = searchArticles(db, "zzznomatch");
    expect(results).toEqual([]);
  });

  it("returns an empty array for an empty query without crashing", () => {
    const feed = seedFeed();
    seedArticle(feed.id, { guid: "g1" });

    expect(searchArticles(db, "")).toEqual([]);
    expect(searchArticles(db, "   ")).toEqual([]);
  });

  it("includes feed_title from the joined feeds table", () => {
    const feed = seedFeed({ url: "https://tech.com/feed", title: "Tech News" });
    seedArticle(feed.id, { guid: "g1", title: "TypeScript Tips" });

    const results = searchArticles(db, "TypeScript");
    expect(results).toHaveLength(1);
    expect(results[0].feed_title).toBe("Tech News");
  });

  it("respects the limit parameter", () => {
    const feed = seedFeed();
    for (let i = 0; i < 5; i++) {
      seedArticle(feed.id, {
        guid: `guid-${i}`,
        title: `Article number ${i}`,
        content: "searchable keyword present",
      });
    }

    const results = searchArticles(db, "searchable", 3);
    expect(results).toHaveLength(3);
  });
});
