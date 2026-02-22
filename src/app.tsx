import type { Database } from "bun:sqlite";
import { exec } from "node:child_process";
import { platform } from "node:os";
import { convert } from "html-to-text";
import { Box, useApp, useInput } from "ink";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "./components/StatusBar";
import type { Article, Feed, FeedWithUnread } from "./db/queries";
import {
  getFeedById,
  listAllArticles,
  listArticlesByFeed,
  listFeeds,
  markAllArticlesRead,
  markArticleRead,
  removeFeed,
  toggleArticleStarred,
} from "./db/queries";
import { addFeed as addFeedToDb } from "./db/queries";
import { fetchAndParseFeed, refreshAllFeeds, refreshFeed } from "./services/feed";
import { importOpml } from "./services/opml";
import { searchArticles } from "./services/search";
import type { SearchResult } from "./services/search";
import { AddFeed } from "./views/AddFeed";
import { ArticleList } from "./views/ArticleList";
import { ArticleView } from "./views/ArticleView";
import { FeedList } from "./views/FeedList";
import { Search } from "./views/Search";

type View = "feedList" | "articleList" | "articleView" | "addFeed" | "search";

interface AppProps {
  db: Database;
  initialOpmlPath?: string;
}

function openInBrowser(url: string) {
  const cmd = platform() === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

export function App({ db, initialOpmlPath }: AppProps) {
  const { exit } = useApp();

  // ── View state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("feedList");

  // ── Feed list ────────────────────────────────────────────────────────────────
  const [feeds, setFeeds] = useState<FeedWithUnread[]>([]);
  const [feedIndex, setFeedIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();

  // ── Article list ─────────────────────────────────────────────────────────────
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleIndex, setArticleIndex] = useState(0);
  const [currentFeedTitle, setCurrentFeedTitle] = useState("All");

  // ── Article view ─────────────────────────────────────────────────────────────
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [renderedContent, setRenderedContent] = useState("");
  const [scrollOffset, setScrollOffset] = useState(0);

  // ── Add feed ─────────────────────────────────────────────────────────────────
  const [addFeedError, setAddFeedError] = useState<string | undefined>();

  // ── Search ───────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);

  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const reloadFeeds = useCallback(() => {
    setFeeds(listFeeds(db));
  }, [db]);

  const flash = useCallback((msg: string, ms = 2000) => {
    setStatusMessage(msg);
    if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
    refreshTimeout.current = setTimeout(() => setStatusMessage(undefined), ms);
  }, []);

  const doRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await refreshAllFeeds(db);
    reloadFeeds();
    setIsRefreshing(false);
    flash("Feeds refreshed");
  }, [db, reloadFeeds, flash]);

  // ── On mount: auto-refresh + optional OPML import ────────────────────────────
  useEffect(() => {
    reloadFeeds();
    doRefreshAll();

    if (initialOpmlPath) {
      importOpml(db, initialOpmlPath)
        .then((result) => {
          flash(`OPML imported: ${result.added} added, ${result.skipped} skipped`);
          reloadFeeds();
        })
        .catch((err: Error) => flash(`OPML error: ${err.message}`));
    }
  }, [db, reloadFeeds, doRefreshAll, flash, initialOpmlPath]);

  // ── Search: update results on query change ───────────────────────────────────
  useEffect(() => {
    if (view !== "search") return;
    const results = searchArticles(db, searchQuery);
    setSearchResults(results);
    setSearchIndex(0);
  }, [searchQuery, view, db]);

  // ── Input handling ───────────────────────────────────────────────────────────
  useInput((input, key) => {
    if (view === "addFeed" || view === "search") {
      if (key.escape) {
        setView("feedList");
        setSearchQuery("");
      }
      return;
    }

    // Global navigation
    if (key.escape || input === "q") {
      if (view === "articleView") {
        setView("articleList");
      } else if (view === "articleList") {
        setView("feedList");
      } else {
        exit();
      }
      return;
    }

    if (view === "feedList") {
      if (input === "j" || key.downArrow) setFeedIndex((i) => Math.min(i + 1, feeds.length - 1));
      else if (input === "k" || key.upArrow) setFeedIndex((i) => Math.max(i - 1, 0));
      else if (key.return) openFeedArticles();
      else if (input === "a") {
        setAddFeedError(undefined);
        setView("addFeed");
      } else if (input === "d") deleteFeed();
      else if (input === "r") doRefreshAll();
      else if (input === "i") promptOpmlImport();
      else if (input === "/") {
        setSearchQuery("");
        setView("search");
      }
    }

    if (view === "articleList") {
      if (input === "j" || key.downArrow)
        setArticleIndex((i) => Math.min(i + 1, articles.length - 1));
      else if (input === "k" || key.upArrow) setArticleIndex((i) => Math.max(i - 1, 0));
      else if (key.return) openArticle();
      else if (input === "s") toggleStar();
      else if (input === "m") toggleRead();
      else if (input === "r") refreshCurrentFeed();
      else if (input === "/") {
        setSearchQuery("");
        setView("search");
      }
    }

    if (view === "articleView") {
      if (input === "j" || key.downArrow) setScrollOffset((s) => s + 1);
      else if (input === "k" || key.upArrow) setScrollOffset((s) => Math.max(0, s - 1));
      else if (input === "s" && currentArticle) toggleArticleStarred(db, currentArticle.id);
      else if (input === "m" && currentArticle) {
        markArticleRead(db, currentArticle.id, currentArticle.is_read !== 1);
        reloadFeeds();
      } else if (input === "o" && currentArticle?.link) openInBrowser(currentArticle.link);
    }
  });

  // ── Feed list actions ─────────────────────────────────────────────────────────
  function openFeedArticles() {
    const feed = feeds[feedIndex];
    if (!feed) return;
    const arts = listArticlesByFeed(db, feed.id);
    setArticles(arts);
    setArticleIndex(0);
    setCurrentFeedTitle(feed.title || feed.url);
    setView("articleList");
  }

  function deleteFeed() {
    const feed = feeds[feedIndex];
    if (!feed) return;
    removeFeed(db, feed.id);
    reloadFeeds();
    setFeedIndex((i) => Math.max(0, i - 1));
    flash(`Removed "${feed.title || feed.url}"`);
  }

  function promptOpmlImport() {
    flash("Pass --import <file.opml> on launch to import OPML");
  }

  // ── Article list actions ──────────────────────────────────────────────────────
  function openArticle() {
    const article = articles[articleIndex];
    if (!article) return;
    markArticleRead(db, article.id, true);
    reloadFeeds();
    const text = convert(article.content || article.summary, {
      wordwrap: 80,
      selectors: [
        { selector: "a", options: { ignoreHref: true } },
        { selector: "img", format: "skip" },
      ],
    });
    setRenderedContent(text);
    setScrollOffset(0);
    setCurrentArticle(article);
    setView("articleView");
  }

  function toggleStar() {
    const article = articles[articleIndex];
    if (!article) return;
    toggleArticleStarred(db, article.id);
    const feed = feeds[feedIndex];
    if (feed) setArticles(listArticlesByFeed(db, feed.id));
  }

  function toggleRead() {
    const article = articles[articleIndex];
    if (!article) return;
    markArticleRead(db, article.id, article.is_read !== 1);
    reloadFeeds();
    const feed = feeds[feedIndex];
    if (feed) setArticles(listArticlesByFeed(db, feed.id));
  }

  async function refreshCurrentFeed() {
    const feed = feeds[feedIndex];
    if (!feed) return;
    setIsRefreshing(true);
    await refreshFeed(db, feed.id);
    reloadFeeds();
    setArticles(listArticlesByFeed(db, feed.id));
    setIsRefreshing(false);
    flash(`${feed.title} refreshed`);
  }

  // ── Add feed action ───────────────────────────────────────────────────────────
  async function handleAddFeed(url: string, category: string) {
    try {
      const parsed = await fetchAndParseFeed(url);
      addFeedToDb(db, {
        url,
        title: parsed.title,
        description: parsed.description,
        site_url: parsed.site_url,
        category,
      });
      reloadFeeds();
      setView("feedList");
      flash(`Added "${parsed.title || url}"`);
    } catch (err) {
      setAddFeedError(err instanceof Error ? err.message : "Failed to fetch feed");
    }
  }

  // ── Search action ─────────────────────────────────────────────────────────────
  function handleSearchSelect(result: SearchResult) {
    const feed = getFeedById(db, result.feed_id);
    const arts = feed ? listArticlesByFeed(db, feed.id) : listAllArticles(db);
    const idx = arts.findIndex((a) => a.id === result.id);
    setArticles(arts);
    setArticleIndex(idx >= 0 ? idx : 0);
    setCurrentFeedTitle((feed as Feed | undefined)?.title || "All");
    setView("articleList");
  }

  // ── Status bar hints per view ─────────────────────────────────────────────────
  const hints: Record<View, { key: string; label: string }[]> = {
    feedList: [
      { key: "j/k", label: "navigate" },
      { key: "↵", label: "open" },
      { key: "a", label: "add" },
      { key: "d", label: "delete" },
      { key: "r", label: "refresh" },
      { key: "/", label: "search" },
      { key: "q", label: "quit" },
    ],
    articleList: [
      { key: "j/k", label: "navigate" },
      { key: "↵", label: "read" },
      { key: "s", label: "star" },
      { key: "m", label: "read/unread" },
      { key: "r", label: "refresh" },
      { key: "/", label: "search" },
      { key: "Esc", label: "back" },
    ],
    articleView: [
      { key: "j/k", label: "scroll" },
      { key: "o", label: "browser" },
      { key: "s", label: "star" },
      { key: "m", label: "read/unread" },
      { key: "Esc/q", label: "back" },
    ],
    addFeed: [
      { key: "↵", label: "confirm" },
      { key: "Esc", label: "cancel" },
    ],
    search: [
      { key: "↵", label: "open" },
      { key: "Esc", label: "back" },
    ],
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" height={process.stdout.rows ?? 24}>
      <Box flexGrow={1} flexDirection="column">
        {view === "feedList" && (
          <FeedList feeds={feeds} selectedIndex={feedIndex} isRefreshing={isRefreshing} />
        )}
        {view === "articleList" && (
          <ArticleList
            articles={articles}
            selectedIndex={articleIndex}
            feedTitle={currentFeedTitle}
          />
        )}
        {view === "articleView" && currentArticle && (
          <ArticleView
            article={currentArticle}
            feedTitle={currentFeedTitle}
            renderedContent={renderedContent}
            scrollOffset={scrollOffset}
          />
        )}
        {view === "addFeed" && (
          <AddFeed
            onAdd={handleAddFeed}
            onCancel={() => setView("feedList")}
            error={addFeedError}
          />
        )}
        {view === "search" && (
          <Search
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            selectedIndex={searchIndex}
            onSelect={handleSearchSelect}
          />
        )}
      </Box>
      <StatusBar hints={hints[view]} message={statusMessage} />
    </Box>
  );
}
