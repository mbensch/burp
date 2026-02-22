import { Box, Text } from "ink";
import React from "react";

const ASCII_ART = `
  ██████╗ ██╗   ██╗██████╗ ██████╗ 
  ██╔══██╗██║   ██║██╔══██╗██╔══██╗
  ██████╔╝██║   ██║██████╔╝██████╔╝
  ██╔══██╗██║   ██║██╔══██╗██╔═══╝ 
  ██████╔╝╚██████╔╝██║  ██║██║     
  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝    `.trimStart();

export function Header() {
  return (
    <Box borderStyle="double" borderColor="cyan" flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="cyan" bold>
        {ASCII_ART}
      </Text>
      <Text dimColor>A cheeky terminal RSS reader</Text>
    </Box>
  );
}
