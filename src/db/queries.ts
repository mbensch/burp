import type { Database } from "bun:sqlite";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Feed {
  id: number;
  url: string;
  title: string;
  description: string;
  site_url: string;
  category: string;
  created_at: number;
  last_fetched_at: number | null;
}

export interface FeedWithUnread extends Feed {
  unread_count: number;
}

export interface Article {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  content: string;
  summary: string;
  author: string;
  published_at: number | null;
  is_read: 0 | 1;
  is_starred: 0 | 1;
  created_at: number;
}

export interface Tag {
  id: number;
  name: string;
}

// ─── Feed queries ─────────────────────────────────────────────────────────────

export function addFeed(
  db: Database,
  feed: Pick<Feed, "url" | "title" | "description" | "site_url" | "category">,
): Feed {
  return db
    .prepare<Feed, [string, string, string, string, string]>(
      `INSERT INTO feeds (url, title, description, site_url, category)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         title       = excluded.title,
         description = excluded.description,
         site_url    = excluded.site_url,
         category    = excluded.category
       RETURNING *`,
    )
    .get(feed.url, feed.title, feed.description, feed.site_url, feed.category) as Feed;
}

export function removeFeed(db: Database, id: number): void {
  db.prepare("DELETE FROM feeds WHERE id = ?").run(id);
}

export function getFeedById(db: Database, id: number): Feed | null {
  return db.prepare<Feed, [number]>("SELECT * FROM feeds WHERE id = ?").get(id);
}

export function getFeedByUrl(db: Database, url: string): Feed | null {
  return db.prepare<Feed, [string]>("SELECT * FROM feeds WHERE url = ?").get(url);
}

export function listFeeds(db: Database): FeedWithUnread[] {
  return db
    .prepare<FeedWithUnread, []>(
      `SELECT f.*,
              COUNT(CASE WHEN a.is_read = 0 THEN 1 END) AS unread_count
       FROM feeds f
       LEFT JOIN articles a ON a.feed_id = f.id
       GROUP BY f.id
       ORDER BY f.title COLLATE NOCASE`,
    )
    .all();
}

export function touchFeedFetchedAt(db: Database, id: number): void {
  db.prepare("UPDATE feeds SET last_fetched_at = unixepoch() WHERE id = ?").run(id);
}

// ─── Article queries ──────────────────────────────────────────────────────────

export interface UpsertArticleInput {
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  content: string;
  summary: string;
  author: string;
  published_at: number | null;
}

export function upsertArticle(db: Database, article: UpsertArticleInput): Article {
  return db
    .prepare<Article, [number, string, string, string, string, string, string, number | null]>(
      `INSERT INTO articles (feed_id, guid, title, link, content, summary, author, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(feed_id, guid) DO UPDATE SET
         title        = excluded.title,
         link         = excluded.link,
         content      = excluded.content,
         summary      = excluded.summary,
         author       = excluded.author,
         published_at = excluded.published_at
       RETURNING *`,
    )
    .get(
      article.feed_id,
      article.guid,
      article.title,
      article.link,
      article.content,
      article.summary,
      article.author,
      article.published_at,
    ) as Article;
}

export function listArticlesByFeed(db: Database, feedId: number, limit = 100): Article[] {
  return db
    .prepare<Article, [number, number]>(
      `SELECT * FROM articles
       WHERE feed_id = ?
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT ?`,
    )
    .all(feedId, limit);
}

export function listAllArticles(db: Database, limit = 200): Article[] {
  return db
    .prepare<Article, [number]>(
      `SELECT * FROM articles
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT ?`,
    )
    .all(limit);
}

export function listStarredArticles(db: Database): Article[] {
  return db
    .prepare<Article, []>(
      `SELECT * FROM articles
       WHERE is_starred = 1
       ORDER BY COALESCE(published_at, created_at) DESC`,
    )
    .all();
}

export function getArticleById(db: Database, id: number): Article | null {
  return db.prepare<Article, [number]>("SELECT * FROM articles WHERE id = ?").get(id);
}

export function markArticleRead(db: Database, id: number, isRead: boolean): void {
  db.prepare("UPDATE articles SET is_read = ? WHERE id = ?").run(isRead ? 1 : 0, id);
}

export function markAllArticlesRead(db: Database, feedId: number): void {
  db.prepare("UPDATE articles SET is_read = 1 WHERE feed_id = ?").run(feedId);
}

export function toggleArticleStarred(db: Database, id: number): void {
  db.prepare("UPDATE articles SET is_starred = (1 - is_starred) WHERE id = ?").run(id);
}

export function getUnreadCount(db: Database, feedId: number): number {
  const row = db
    .prepare<{ c: number }, [number]>(
      "SELECT COUNT(*) as c FROM articles WHERE feed_id = ? AND is_read = 0",
    )
    .get(feedId);
  return row?.c ?? 0;
}

// ─── Tag queries ──────────────────────────────────────────────────────────────

export function getOrCreateTag(db: Database, name: string): Tag {
  db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(name);
  return db.prepare<Tag, [string]>("SELECT * FROM tags WHERE name = ?").get(name) as Tag;
}

export function listTags(db: Database): Tag[] {
  return db.prepare<Tag, []>("SELECT * FROM tags ORDER BY name COLLATE NOCASE").all();
}

export function addTagToArticle(db: Database, articleId: number, tagId: number): void {
  db.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)").run(
    articleId,
    tagId,
  );
}

export function removeTagFromArticle(db: Database, articleId: number, tagId: number): void {
  db.prepare("DELETE FROM article_tags WHERE article_id = ? AND tag_id = ?").run(articleId, tagId);
}

export function listTagsForArticle(db: Database, articleId: number): Tag[] {
  return db
    .prepare<Tag, [number]>(
      `SELECT t.* FROM tags t
       JOIN article_tags at ON at.tag_id = t.id
       WHERE at.article_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(articleId);
}

export function listArticlesByTag(db: Database, tagId: number): Article[] {
  return db
    .prepare<Article, [number]>(
      `SELECT a.* FROM articles a
       JOIN article_tags at ON at.article_id = a.id
       WHERE at.tag_id = ?
       ORDER BY COALESCE(a.published_at, a.created_at) DESC`,
    )
    .all(tagId);
}
