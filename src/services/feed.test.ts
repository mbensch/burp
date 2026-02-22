import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import Parser from "rss-parser";
import { addFeed, listArticlesByFeed } from "../db/queries";
import { runMigrations } from "../db/schema";
import * as feedService from "./feed";

let db: Database;
let parseURLSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
});

afterEach(() => {
  db.close();
  parseURLSpy?.mockRestore();
});

const MOCK_PARSED_FEED: feedService.ParsedFeed = {
  title: "Test Feed",
  description: "A feed for testing",
  site_url: "https://example.com",
  items: [
    {
      guid: "guid-1",
      title: "Article One",
      link: "https://example.com/1",
      content: "Full content one",
      summary: "Summary one",
      author: "Alice",
      published_at: 1700000000,
    },
    {
      guid: "guid-2",
      title: "Article Two",
      link: "https://example.com/2",
      content: "Full content two",
      summary: "Summary two",
      author: "Bob",
      published_at: 1700000100,
    },
  ],
};

function mockParseURL(feed: feedService.ParsedFeed) {
  parseURLSpy = spyOn(Parser.prototype, "parseURL").mockResolvedValue({
    title: feed.title,
    description: feed.description,
    link: feed.site_url,
    items: feed.items.map((item) => ({
      guid: item.guid,
      title: item.title,
      link: item.link,
      content: item.content,
      contentSnippet: item.summary,
      creator: item.author,
      pubDate: item.published_at ? new Date(item.published_at * 1000).toUTCString() : undefined,
    })),
  } as never);
}

describe("refreshFeed", () => {
  it("inserts articles from a parsed feed into the DB", async () => {
    mockParseURL(MOCK_PARSED_FEED);

    const dbFeed = addFeed(db, {
      url: "https://example.com/feed",
      title: "Test Feed",
      description: "",
      site_url: "",
      category: "",
    });

    const result = await feedService.refreshFeed(db, dbFeed.id);

    expect(result.errors).toHaveLength(0);
    expect(result.added).toBe(2);

    const articles = listArticlesByFeed(db, dbFeed.id);
    expect(articles).toHaveLength(2);
    expect(articles.map((a) => a.guid)).toContain("guid-1");
  });

  it("does not create duplicates when re-fetching the same feed", async () => {
    mockParseURL(MOCK_PARSED_FEED);

    const dbFeed = addFeed(db, {
      url: "https://example.com/feed",
      title: "Test Feed",
      description: "",
      site_url: "",
      category: "",
    });

    await feedService.refreshFeed(db, dbFeed.id);
    await feedService.refreshFeed(db, dbFeed.id);

    const articles = listArticlesByFeed(db, dbFeed.id);
    expect(articles).toHaveLength(2);
  });

  it("catches a parse/network error and returns it in errors, does not throw", async () => {
    parseURLSpy = spyOn(Parser.prototype, "parseURL").mockRejectedValue(
      new Error("Network timeout"),
    );

    const dbFeed = addFeed(db, {
      url: "https://bad-url.example.com/feed",
      title: "Bad Feed",
      description: "",
      site_url: "",
      category: "",
    });

    const result = await feedService.refreshFeed(db, dbFeed.id);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Network timeout");
    expect(result.added).toBe(0);
  });

  it("returns an error for an unknown feedId without throwing", async () => {
    const result = await feedService.refreshFeed(db, 9999);
    expect(result.errors).toHaveLength(1);
    expect(result.added).toBe(0);
  });
});

describe("refreshAllFeeds", () => {
  it("processes all feeds and returns one result per feed", async () => {
    mockParseURL(MOCK_PARSED_FEED);

    addFeed(db, {
      url: "https://a.com/feed",
      title: "Feed A",
      description: "",
      site_url: "",
      category: "",
    });
    addFeed(db, {
      url: "https://b.com/feed",
      title: "Feed B",
      description: "",
      site_url: "",
      category: "",
    });

    const results = await feedService.refreshAllFeeds(db);

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.added).toBe(2);
      expect(r.errors).toHaveLength(0);
    }
  });
});
