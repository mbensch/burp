import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { runMigrations } from "./schema";

let db: Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
});

afterEach(() => {
  db.close();
});

describe("runMigrations", () => {
  it("creates all tables on first run", () => {
    runMigrations(db);

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {
        name: string;
      }[]
    ).map((r) => r.name);

    expect(tables).toContain("feeds");
    expect(tables).toContain("articles");
    expect(tables).toContain("tags");
    expect(tables).toContain("article_tags");
    expect(tables).toContain("migrations");
  });

  it("creates the FTS5 virtual table", () => {
    runMigrations(db);

    const vtable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='articles_fts'")
      .get();

    expect(vtable).toBeTruthy();
  });

  it("records applied migration versions", () => {
    runMigrations(db);

    const versions = (
      db.prepare("SELECT version FROM migrations").all() as { version: number }[]
    ).map((r) => r.version);

    expect(versions).toContain(1);
  });

  it("is idempotent — running twice does not error or duplicate", () => {
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();

    const count = (db.prepare("SELECT COUNT(*) as c FROM migrations").get() as { c: number }).c;
    expect(count).toBe(1);
  });

  it("FTS5 triggers keep the index in sync on insert", () => {
    runMigrations(db);

    db.prepare("INSERT INTO feeds (url, title) VALUES (?, ?)").run(
      "https://example.com/feed",
      "Test Feed",
    );
    db.prepare(
      "INSERT INTO articles (feed_id, guid, title, content) VALUES (1, 'g1', 'Hello World', 'Some content here')",
    ).run();

    const results = db
      .prepare("SELECT rowid FROM articles_fts WHERE articles_fts MATCH 'Hello'")
      .all();
    expect(results.length).toBe(1);
  });

  it("FTS5 triggers remove deleted articles from the index", () => {
    runMigrations(db);

    db.prepare("INSERT INTO feeds (url, title) VALUES (?, ?)").run(
      "https://example.com/feed",
      "Test Feed",
    );
    db.prepare(
      "INSERT INTO articles (feed_id, guid, title, content) VALUES (1, 'g1', 'Goodbye World', 'Some content')",
    ).run();

    db.prepare("DELETE FROM articles WHERE guid = 'g1'").run();

    const results = db
      .prepare("SELECT rowid FROM articles_fts WHERE articles_fts MATCH 'Goodbye'")
      .all();
    expect(results.length).toBe(0);
  });
});
