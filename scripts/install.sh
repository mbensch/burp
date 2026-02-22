#!/usr/bin/env sh
set -eu

REPO="mbensch/burp"
BIN_NAME="burp"
INSTALL_DIR="${BURP_INSTALL_DIR:-$HOME/.local/bin}"

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin) OS="darwin" ;;
  Linux)  OS="linux"  ;;
  *)
    echo "Unsupported OS: $OS" >&2
    exit 1
    ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64 | amd64) ARCH="x64"   ;;
  arm64  | aarch64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

ASSET="${BIN_NAME}-${OS}-${ARCH}"
URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

echo "Downloading burp (${OS}/${ARCH})…"

# Download
TMP="$(mktemp)"
if command -v curl > /dev/null 2>&1; then
  curl -fsSL "$URL" -o "$TMP"
elif command -v wget > /dev/null 2>&1; then
  wget -q "$URL" -O "$TMP"
else
  echo "Neither curl nor wget found. Please install one and retry." >&2
  exit 1
fi

# Install
mkdir -p "$INSTALL_DIR"
mv "$TMP" "$INSTALL_DIR/$BIN_NAME"
chmod +x "$INSTALL_DIR/$BIN_NAME"

echo "Installed burp to $INSTALL_DIR/$BIN_NAME"

# PATH hint
case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    echo ""
    echo "Add the following to your shell profile to use 'burp' from anywhere:"
    echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
    ;;
esac
