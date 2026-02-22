import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import React from "react";
import type { SearchResult } from "../services/search";

interface SearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
}

export function Search({ query, onQueryChange, results, selectedIndex }: SearchProps) {
  return (
    <Box flexDirection="column" flexGrow={1} padding={1} gap={1}>
      <Box gap={1}>
        <Text color="cyan" bold>
          Search:
        </Text>
        <TextInput value={query} onChange={onQueryChange} placeholder="Type to search…" />
      </Box>

      {results.length === 0 && query.trim() ? (
        <Box paddingX={1}>
          <Text dimColor>No results for "{query}"</Text>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          {results.map((result, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={result.id} paddingX={1}>
                <Text
                  color={isSelected ? "cyan" : undefined}
                  bold={isSelected}
                  inverse={isSelected}
                >
                  {isSelected ? "▶ " : "  "}
                  {result.title || "(no title)"}
                  <Text dimColor> {result.feed_title}</Text>
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
