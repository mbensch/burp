import type { Database } from "bun:sqlite";
import Parser from "rss-parser";
import type { UpsertArticleInput } from "../db/queries";
import { getFeedById, listFeeds, touchFeedFetchedAt, upsertArticle } from "../db/queries";

export interface ParsedFeedItem {
  guid: string;
  title: string;
  link: string;
  content: string;
  summary: string;
  author: string;
  published_at: number | null;
}

export interface ParsedFeed {
  title: string;
  description: string;
  site_url: string;
  items: ParsedFeedItem[];
}

export interface RefreshResult {
  feedId: number;
  added: number;
  errors: string[];
}

const parser = new Parser({
  customFields: {
    item: [["content:encoded", "content:encoded"]],
  },
});

function toUnixSeconds(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const ms = Date.parse(dateStr);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

export async function fetchAndParseFeed(url: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(url);

  const items: ParsedFeedItem[] = (feed.items ?? []).map((item) => ({
    guid: item.guid ?? item.link ?? item.title ?? "",
    title: item.title ?? "",
    link: item.link ?? "",
    content: (item as Record<string, string>)["content:encoded"] ?? item.content ?? "",
    summary: item.contentSnippet ?? "",
    author: item.creator ?? item.author ?? "",
    published_at: toUnixSeconds(item.pubDate ?? item.isoDate),
  }));

  return {
    title: feed.title ?? "",
    description: feed.description ?? "",
    site_url: feed.link ?? "",
    items,
  };
}

export async function refreshFeed(db: Database, feedId: number): Promise<RefreshResult> {
  const result: RefreshResult = { feedId, added: 0, errors: [] };

  const feed = getFeedById(db, feedId);
  if (!feed) {
    result.errors.push(`Feed ${feedId} not found`);
    return result;
  }

  let parsed: ParsedFeed;
  try {
    parsed = await fetchAndParseFeed(feed.url);
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }

  for (const item of parsed.items) {
    try {
      const input: UpsertArticleInput = {
        feed_id: feedId,
        guid: item.guid,
        title: item.title,
        link: item.link,
        content: item.content,
        summary: item.summary,
        author: item.author,
        published_at: item.published_at,
      };
      upsertArticle(db, input);
      result.added++;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  touchFeedFetchedAt(db, feedId);
  return result;
}

export async function refreshAllFeeds(db: Database): Promise<RefreshResult[]> {
  const feeds = listFeeds(db);
  return Promise.all(feeds.map((f) => refreshFeed(db, f.id)));
}
