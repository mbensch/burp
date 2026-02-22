import { Text } from "ink";
import React from "react";

interface TagProps {
  name: string;
  color?: string;
}

export function Tag({ name, color = "magenta" }: TagProps) {
  return <Text color={color}>[{name}]</Text>;
}
