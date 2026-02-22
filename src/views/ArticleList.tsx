import { Box, Text } from "ink";
import React from "react";
import type { Article } from "../db/queries";

interface ArticleListProps {
  articles: Article[];
  selectedIndex: number;
  feedTitle: string;
}

function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ArticleList({ articles, selectedIndex, feedTitle }: ArticleListProps) {
  if (articles.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>No articles in {feedTitle}.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} marginBottom={1}>
        <Text bold color="cyan">
          {feedTitle}
        </Text>
      </Box>
      {articles.map((article, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={article.id} paddingX={1} gap={1}>
            <Text
              color={isSelected ? "cyan" : article.is_read ? undefined : "white"}
              bold={!article.is_read}
              inverse={isSelected}
            >
              {isSelected ? "▶ " : "  "}
              {article.is_starred ? "★ " : "  "}
              {article.is_read ? "" : "● "}
              {article.title || "(no title)"}
              <Text dimColor> {formatDate(article.published_at)}</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
