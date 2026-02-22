import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addFeed,
  addTagToArticle,
  getArticleById,
  getFeedById,
  getFeedByUrl,
  getOrCreateTag,
  getUnreadCount,
  listAllArticles,
  listArticlesByFeed,
  listArticlesByTag,
  listFeeds,
  listStarredArticles,
  listTags,
  listTagsForArticle,
  markAllArticlesRead,
  markArticleRead,
  removeFeed,
  removeTagFromArticle,
  toggleArticleStarred,
  touchFeedFetchedAt,
  upsertArticle,
} from "./queries";
import { runMigrations } from "./schema";

let db: Database.Database;

function seedFeed(overrides = {}) {
  return addFeed(db, {
    url: "https://example.com/feed",
    title: "Example Feed",
    description: "A test feed",
    site_url: "https://example.com",
    category: "tech",
    ...overrides,
  });
}

function seedArticle(feedId: number, overrides = {}) {
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

// ─── Feed queries ─────────────────────────────────────────────────────────────

describe("addFeed", () => {
  it("inserts a new feed and returns it", () => {
    const feed = seedFeed();
    expect(feed.id).toBeTypeOf("number");
    expect(feed.url).toBe("https://example.com/feed");
    expect(feed.category).toBe("tech");
  });

  it("upserts on duplicate URL, updating metadata", () => {
    seedFeed({ title: "Old Title" });
    const updated = seedFeed({ title: "New Title" });
    expect(updated.title).toBe("New Title");

    const all = listFeeds(db);
    expect(all).toHaveLength(1);
  });
});

describe("removeFeed", () => {
  it("deletes a feed and its articles via cascade", () => {
    const feed = seedFeed();
    seedArticle(feed.id);

    removeFeed(db, feed.id);

    expect(getFeedById(db, feed.id)).toBeUndefined();
    expect(listAllArticles(db)).toHaveLength(0);
  });
});

describe("getFeedById / getFeedByUrl", () => {
  it("returns the feed by id", () => {
    const feed = seedFeed();
    expect(getFeedById(db, feed.id)?.url).toBe(feed.url);
  });

  it("returns the feed by url", () => {
    const feed = seedFeed();
    expect(getFeedByUrl(db, feed.url)?.id).toBe(feed.id);
  });

  it("returns undefined for unknown id", () => {
    expect(getFeedById(db, 9999)).toBeUndefined();
  });
});

describe("listFeeds", () => {
  it("includes unread_count per feed", () => {
    const feed = seedFeed();
    seedArticle(feed.id);
    seedArticle(feed.id);

    const [listed] = listFeeds(db);
    expect(listed.unread_count).toBe(2);
  });

  it("unread_count drops after marking read", () => {
    const feed = seedFeed();
    const article = seedArticle(feed.id);
    markArticleRead(db, article.id, true);

    const [listed] = listFeeds(db);
    expect(listed.unread_count).toBe(0);
  });
});

describe("touchFeedFetchedAt", () => {
  it("sets last_fetched_at to current time", () => {
    const feed = seedFeed();
    expect(feed.last_fetched_at).toBeNull();

    touchFeedFetchedAt(db, feed.id);

    const updated = getFeedById(db, feed.id);
    expect(updated?.last_fetched_at).toBeTypeOf("number");
  });
});

// ─── Article queries ──────────────────────────────────────────────────────────

describe("upsertArticle", () => {
  it("inserts a new article", () => {
    const feed = seedFeed();
    const article = upsertArticle(db, {
      feed_id: feed.id,
      guid: "unique-guid",
      title: "Hello",
      link: "https://example.com/1",
      content: "Body",
      summary: "Sum",
      author: "Alice",
      published_at: 1000,
    });
    expect(article.id).toBeTypeOf("number");
    expect(article.is_read).toBe(0);
    expect(article.is_starred).toBe(0);
  });

  it("does not duplicate on re-upsert with same guid", () => {
    const feed = seedFeed();
    upsertArticle(db, {
      feed_id: feed.id,
      guid: "same-guid",
      title: "v1",
      link: "",
      content: "",
      summary: "",
      author: "",
      published_at: null,
    });
    upsertArticle(db, {
      feed_id: feed.id,
      guid: "same-guid",
      title: "v2",
      link: "",
      content: "",
      summary: "",
      author: "",
      published_at: null,
    });

    const articles = listArticlesByFeed(db, feed.id);
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("v2");
  });
});

describe("listArticlesByFeed", () => {
  it("returns articles sorted by published_at desc", () => {
    const feed = seedFeed();
    seedArticle(feed.id, { guid: "g1", published_at: 1000 });
    seedArticle(feed.id, { guid: "g2", published_at: 3000 });
    seedArticle(feed.id, { guid: "g3", published_at: 2000 });

    const articles = listArticlesByFeed(db, feed.id);
    expect(articles.map((a) => a.published_at)).toEqual([3000, 2000, 1000]);
  });
});

describe("listAllArticles", () => {
  it("returns articles from all feeds sorted by date", () => {
    const f1 = seedFeed({ url: "https://a.com/feed" });
    const f2 = seedFeed({ url: "https://b.com/feed" });
    seedArticle(f1.id, { guid: "g1", published_at: 2000 });
    seedArticle(f2.id, { guid: "g2", published_at: 1000 });

    const all = listAllArticles(db);
    expect(all[0].published_at).toBe(2000);
    expect(all[1].published_at).toBe(1000);
  });
});

describe("markArticleRead / markAllArticlesRead", () => {
  it("marks a single article as read", () => {
    const feed = seedFeed();
    const article = seedArticle(feed.id);

    markArticleRead(db, article.id, true);
    expect(getArticleById(db, article.id)?.is_read).toBe(1);

    markArticleRead(db, article.id, false);
    expect(getArticleById(db, article.id)?.is_read).toBe(0);
  });

  it("marks all articles in a feed as read", () => {
    const feed = seedFeed();
    seedArticle(feed.id, { guid: "g1" });
    seedArticle(feed.id, { guid: "g2" });

    markAllArticlesRead(db, feed.id);
    expect(getUnreadCount(db, feed.id)).toBe(0);
  });
});

describe("toggleArticleStarred", () => {
  it("toggles starred on and off", () => {
    const feed = seedFeed();
    const article = seedArticle(feed.id);

    toggleArticleStarred(db, article.id);
    expect(getArticleById(db, article.id)?.is_starred).toBe(1);

    toggleArticleStarred(db, article.id);
    expect(getArticleById(db, article.id)?.is_starred).toBe(0);
  });
});

describe("listStarredArticles", () => {
  it("returns only starred articles", () => {
    const feed = seedFeed();
    const a1 = seedArticle(feed.id, { guid: "g1" });
    seedArticle(feed.id, { guid: "g2" });

    toggleArticleStarred(db, a1.id);

    const starred = listStarredArticles(db);
    expect(starred).toHaveLength(1);
    expect(starred[0].id).toBe(a1.id);
  });
});

describe("getUnreadCount", () => {
  it("returns correct unread count for a feed", () => {
    const feed = seedFeed();
    const a1 = seedArticle(feed.id, { guid: "g1" });
    seedArticle(feed.id, { guid: "g2" });

    expect(getUnreadCount(db, feed.id)).toBe(2);

    markArticleRead(db, a1.id, true);
    expect(getUnreadCount(db, feed.id)).toBe(1);
  });
});

// ─── Tag queries ──────────────────────────────────────────────────────────────

describe("getOrCreateTag", () => {
  it("creates a tag and returns it", () => {
    const tag = getOrCreateTag(db, "typescript");
    expect(tag.id).toBeTypeOf("number");
    expect(tag.name).toBe("typescript");
  });

  it("is idempotent — returns same tag on second call", () => {
    const t1 = getOrCreateTag(db, "typescript");
    const t2 = getOrCreateTag(db, "typescript");
    expect(t1.id).toBe(t2.id);
  });
});

describe("addTagToArticle / listTagsForArticle / removeTagFromArticle", () => {
  it("associates a tag with an article", () => {
    const feed = seedFeed();
    const article = seedArticle(feed.id);
    const tag = getOrCreateTag(db, "news");

    addTagToArticle(db, article.id, tag.id);

    const tags = listTagsForArticle(db, article.id);
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe("news");
  });

  it("is idempotent — adding same tag twice doesn't duplicate", () => {
    const feed = seedFeed();
    const article = seedArticle(feed.id);
    const tag = getOrCreateTag(db, "news");

    addTagToArticle(db, article.id, tag.id);
    addTagToArticle(db, article.id, tag.id);

    expect(listTagsForArticle(db, article.id)).toHaveLength(1);
  });

  it("removes a tag from an article", () => {
    const feed = seedFeed();
    const article = seedArticle(feed.id);
    const tag = getOrCreateTag(db, "news");

    addTagToArticle(db, article.id, tag.id);
    removeTagFromArticle(db, article.id, tag.id);

    expect(listTagsForArticle(db, article.id)).toHaveLength(0);
  });
});

describe("listArticlesByTag", () => {
  it("returns only articles with the given tag", () => {
    const feed = seedFeed();
    const a1 = seedArticle(feed.id, { guid: "g1" });
    seedArticle(feed.id, { guid: "g2" });
    const tag = getOrCreateTag(db, "featured");

    addTagToArticle(db, a1.id, tag.id);

    const results = listArticlesByTag(db, tag.id);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(a1.id);
  });
});

describe("listTags", () => {
  it("returns all tags sorted alphabetically", () => {
    getOrCreateTag(db, "zebra");
    getOrCreateTag(db, "alpha");

    const tags = listTags(db);
    expect(tags[0].name).toBe("alpha");
    expect(tags[1].name).toBe("zebra");
  });
});
