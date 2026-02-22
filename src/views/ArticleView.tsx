import { Box, Text } from "ink";
import React from "react";
import type { Article } from "../db/queries";

interface ArticleViewProps {
  article: Article;
  feedTitle: string;
  renderedContent: string;
  scrollOffset: number;
}

function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return "";
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function ArticleView({
  article,
  feedTitle,
  renderedContent,
  scrollOffset,
}: ArticleViewProps) {
  const lines = renderedContent.split("\n");
  const visible = lines.slice(scrollOffset, scrollOffset + 40);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={2}>
      <Box flexDirection="column" marginBottom={1}>
        <Text bold wrap="wrap">
          {article.title}
        </Text>
        <Box gap={2}>
          <Text dimColor>{feedTitle}</Text>
          {article.author ? <Text dimColor>by {article.author}</Text> : null}
          <Text dimColor>{formatDate(article.published_at)}</Text>
        </Box>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {visible.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable scroll lines
          <Text key={i} wrap="wrap">
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
