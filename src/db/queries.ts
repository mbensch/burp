import type Database from "better-sqlite3";

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
  db: Database.Database,
  feed: Pick<Feed, "url" | "title" | "description" | "site_url" | "category">,
): Feed {
  const result = db
    .prepare(
      `INSERT INTO feeds (url, title, description, site_url, category)
       VALUES (@url, @title, @description, @site_url, @category)
       ON CONFLICT(url) DO UPDATE SET
         title       = excluded.title,
         description = excluded.description,
         site_url    = excluded.site_url,
         category    = excluded.category
       RETURNING *`,
    )
    .get(feed) as Feed;
  return result;
}

export function removeFeed(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM feeds WHERE id = ?").run(id);
}

export function getFeedById(db: Database.Database, id: number): Feed | undefined {
  return db.prepare("SELECT * FROM feeds WHERE id = ?").get(id) as Feed | undefined;
}

export function getFeedByUrl(db: Database.Database, url: string): Feed | undefined {
  return db.prepare("SELECT * FROM feeds WHERE url = ?").get(url) as Feed | undefined;
}

export function listFeeds(db: Database.Database): FeedWithUnread[] {
  return db
    .prepare(
      `SELECT f.*,
              COUNT(CASE WHEN a.is_read = 0 THEN 1 END) AS unread_count
       FROM feeds f
       LEFT JOIN articles a ON a.feed_id = f.id
       GROUP BY f.id
       ORDER BY f.title COLLATE NOCASE`,
    )
    .all() as FeedWithUnread[];
}

export function touchFeedFetchedAt(db: Database.Database, id: number): void {
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

export function upsertArticle(db: Database.Database, article: UpsertArticleInput): Article {
  return db
    .prepare(
      `INSERT INTO articles (feed_id, guid, title, link, content, summary, author, published_at)
       VALUES (@feed_id, @guid, @title, @link, @content, @summary, @author, @published_at)
       ON CONFLICT(feed_id, guid) DO UPDATE SET
         title        = excluded.title,
         link         = excluded.link,
         content      = excluded.content,
         summary      = excluded.summary,
         author       = excluded.author,
         published_at = excluded.published_at
       RETURNING *`,
    )
    .get(article) as Article;
}

export function listArticlesByFeed(db: Database.Database, feedId: number, limit = 100): Article[] {
  return db
    .prepare(
      `SELECT * FROM articles
       WHERE feed_id = ?
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT ?`,
    )
    .all(feedId, limit) as Article[];
}

export function listAllArticles(db: Database.Database, limit = 200): Article[] {
  return db
    .prepare(
      `SELECT * FROM articles
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT ?`,
    )
    .all(limit) as Article[];
}

export function listStarredArticles(db: Database.Database): Article[] {
  return db
    .prepare(
      `SELECT * FROM articles
       WHERE is_starred = 1
       ORDER BY COALESCE(published_at, created_at) DESC`,
    )
    .all() as Article[];
}

export function getArticleById(db: Database.Database, id: number): Article | undefined {
  return db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as Article | undefined;
}

export function markArticleRead(db: Database.Database, id: number, isRead: boolean): void {
  db.prepare("UPDATE articles SET is_read = ? WHERE id = ?").run(isRead ? 1 : 0, id);
}

export function markAllArticlesRead(db: Database.Database, feedId: number): void {
  db.prepare("UPDATE articles SET is_read = 1 WHERE feed_id = ?").run(feedId);
}

export function toggleArticleStarred(db: Database.Database, id: number): void {
  db.prepare("UPDATE articles SET is_starred = (1 - is_starred) WHERE id = ?").run(id);
}

export function getUnreadCount(db: Database.Database, feedId: number): number {
  const row = db
    .prepare("SELECT COUNT(*) as c FROM articles WHERE feed_id = ? AND is_read = 0")
    .get(feedId) as { c: number };
  return row.c;
}

// ─── Tag queries ──────────────────────────────────────────────────────────────

export function getOrCreateTag(db: Database.Database, name: string): Tag {
  db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(name);
  return db.prepare("SELECT * FROM tags WHERE name = ?").get(name) as Tag;
}

export function listTags(db: Database.Database): Tag[] {
  return db.prepare("SELECT * FROM tags ORDER BY name COLLATE NOCASE").all() as Tag[];
}

export function addTagToArticle(db: Database.Database, articleId: number, tagId: number): void {
  db.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)").run(
    articleId,
    tagId,
  );
}

export function removeTagFromArticle(
  db: Database.Database,
  articleId: number,
  tagId: number,
): void {
  db.prepare("DELETE FROM article_tags WHERE article_id = ? AND tag_id = ?").run(articleId, tagId);
}

export function listTagsForArticle(db: Database.Database, articleId: number): Tag[] {
  return db
    .prepare(
      `SELECT t.* FROM tags t
       JOIN article_tags at ON at.tag_id = t.id
       WHERE at.article_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(articleId) as Tag[];
}

export function listArticlesByTag(db: Database.Database, tagId: number): Article[] {
  return db
    .prepare(
      `SELECT a.* FROM articles a
       JOIN article_tags at ON at.article_id = a.id
       WHERE at.tag_id = ?
       ORDER BY COALESCE(a.published_at, a.created_at) DESC`,
    )
    .all(tagId) as Article[];
}
