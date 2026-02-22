import type Database from "better-sqlite3";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  summary: string;
  author: string;
  published_at: number | null;
  is_read: 0 | 1;
  is_starred: 0 | 1;
  feed_title: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip FTS5 special characters that would cause a parse error, then append
 * `*` for prefix matching on the last token.
 */
function sanitizeFtsQuery(raw: string): string {
  // Remove FTS5 operator characters: " * ^ ( ) - :
  const stripped = raw.replace(/["*^():+-]/g, " ").trim();

  // Collapse multiple spaces and build the query
  const tokens = stripped.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  // Append * to the last token for prefix matching
  tokens[tokens.length - 1] = `${tokens[tokens.length - 1]}*`;
  return tokens.join(" ");
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function searchArticles(db: Database.Database, query: string, limit = 50): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const ftsQuery = sanitizeFtsQuery(trimmed);
  if (!ftsQuery) return [];

  return db
    .prepare<[string, number], SearchResult>(
      `SELECT
         a.id,
         a.feed_id,
         a.guid,
         a.title,
         a.link,
         a.summary,
         a.author,
         a.published_at,
         a.is_read,
         a.is_starred,
         f.title AS feed_title
       FROM articles_fts fts
       JOIN articles a ON a.id = fts.rowid
       JOIN feeds f ON f.id = a.feed_id
       WHERE articles_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    )
    .all(ftsQuery, limit);
}
