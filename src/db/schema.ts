import type { Database } from "bun:sqlite";

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS feeds (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        url           TEXT    NOT NULL UNIQUE,
        title         TEXT    NOT NULL DEFAULT '',
        description   TEXT    NOT NULL DEFAULT '',
        site_url      TEXT    NOT NULL DEFAULT '',
        category      TEXT    NOT NULL DEFAULT '',
        created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
        last_fetched_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS articles (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id      INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
        guid         TEXT    NOT NULL,
        title        TEXT    NOT NULL DEFAULT '',
        link         TEXT    NOT NULL DEFAULT '',
        content      TEXT    NOT NULL DEFAULT '',
        summary      TEXT    NOT NULL DEFAULT '',
        author       TEXT    NOT NULL DEFAULT '',
        published_at INTEGER,
        is_read      INTEGER NOT NULL DEFAULT 0,
        is_starred   INTEGER NOT NULL DEFAULT 0,
        created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(feed_id, guid)
      );

      CREATE TABLE IF NOT EXISTS tags (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS article_tags (
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        tag_id     INTEGER NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
        PRIMARY KEY (article_id, tag_id)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
        title,
        content,
        content='articles',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS articles_fts_insert
        AFTER INSERT ON articles BEGIN
          INSERT INTO articles_fts(rowid, title, content)
          VALUES (new.id, new.title, new.content);
        END;

      CREATE TRIGGER IF NOT EXISTS articles_fts_update
        AFTER UPDATE ON articles BEGIN
          INSERT INTO articles_fts(articles_fts, rowid, title, content)
          VALUES ('delete', old.id, old.title, old.content);
          INSERT INTO articles_fts(rowid, title, content)
          VALUES (new.id, new.title, new.content);
        END;

      CREATE TRIGGER IF NOT EXISTS articles_fts_delete
        BEFORE DELETE ON articles BEGIN
          INSERT INTO articles_fts(articles_fts, rowid, title, content)
          VALUES ('delete', old.id, old.title, old.content);
        END;
    `,
  },
];

export function runMigrations(db: Database): void {
  db.exec("CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)");

  const applied = new Set<number>(
    db
      .prepare<{ version: number }, []>("SELECT version FROM migrations")
      .all()
      .map((r) => r.version),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO migrations (version) VALUES (?)").run(migration.version);
    })();
  }
}
