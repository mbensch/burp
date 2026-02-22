import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { runMigrations } from "./schema";

const DB_DIR = join(homedir(), ".config", "burp");
const DB_PATH = join(DB_DIR, "burp.db");

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;
  mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");
  runMigrations(_db);
  return _db;
}
