import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import React, { useState } from "react";

interface AddFeedProps {
  onAdd: (url: string, category: string) => void;
  onCancel: () => void;
  error?: string;
}

export function AddFeed({ onAdd, onCancel, error }: AddFeedProps) {
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [focusedField, setFocusedField] = useState<"url" | "category">("url");

  function handleUrlSubmit() {
    setFocusedField("category");
  }

  function handleCategorySubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    onAdd(trimmed, category.trim());
  }

  return (
    <Box flexDirection="column" flexGrow={1} padding={2} gap={1}>
      <Text bold>Add Feed</Text>

      <Box gap={1}>
        <Text color={focusedField === "url" ? "cyan" : "white"}>URL:</Text>
        <TextInput
          value={url}
          onChange={setUrl}
          onSubmit={handleUrlSubmit}
          focus={focusedField === "url"}
          placeholder="https://example.com/feed.xml"
        />
      </Box>

      <Box gap={1}>
        <Text color={focusedField === "category" ? "cyan" : "white"}>Category:</Text>
        <TextInput
          value={category}
          onChange={setCategory}
          onSubmit={handleCategorySubmit}
          focus={focusedField === "category"}
          placeholder="(optional)"
        />
      </Box>

      {error ? <Text color="red">{error}</Text> : null}

      <Box marginTop={1}>
        <Text dimColor>Enter to confirm each field • Esc to cancel</Text>
      </Box>
    </Box>
  );
}
