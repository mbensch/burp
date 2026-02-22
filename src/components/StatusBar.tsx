import { Box, Text } from "ink";
import React from "react";

interface KeyHint {
  key: string;
  label: string;
}

interface StatusBarProps {
  hints: KeyHint[];
  message?: string;
}

export function StatusBar({ hints, message }: StatusBarProps) {
  return (
    <Box
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
    >
      {message ? (
        <Text color="yellow">{message}</Text>
      ) : (
        <Box gap={2} flexWrap="wrap">
          {hints.map(({ key, label }) => (
            <Box key={key} gap={1}>
              <Text bold color="cyan">
                {key}
              </Text>
              <Text dimColor>{label}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
