import { Box, Text } from "ink";
import React from "react";
import type { FeedWithUnread } from "../db/queries";

interface FeedListProps {
  feeds: FeedWithUnread[];
  selectedIndex: number;
  isRefreshing: boolean;
}

export function FeedList({ feeds, selectedIndex, isRefreshing }: FeedListProps) {
  if (isRefreshing) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text color="cyan">Refreshing feeds…</Text>
      </Box>
    );
  }

  if (feeds.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>No feeds yet. Press </Text>
        <Text color="cyan">a</Text>
        <Text dimColor> to add one.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {feeds.map((feed, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={feed.id} paddingX={1}>
            <Text color={isSelected ? "cyan" : undefined} bold={isSelected} inverse={isSelected}>
              {isSelected ? "▶ " : "  "}
              {feed.title || feed.url}
              {feed.category ? <Text dimColor> [{feed.category}]</Text> : null}
              {feed.unread_count > 0 ? <Text color="yellow"> ({feed.unread_count})</Text> : null}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
