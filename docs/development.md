# EchoLingo Development Guide

## Prerequisites

- **Node.js**: v20+ or v24+
- **pnpm**: v10+ (`corepack enable && corepack use pnpm@latest`)
- **Operating System**: Windows 10/11, macOS 12+, or Ubuntu 20.04+

## Initial Setup

```bash
# Clone repository
git clone <repo-url>
cd echo-lingo

# Install all workspace dependencies
pnpm install

# Run automated test suites
pnpm test
```

## Running the Application in Development Mode

```bash
# Start desktop app with hot module replacement (HMR)
pnpm dev
```

## Building & Packaging

```bash
# Compile and bundle main, preload, and renderer
pnpm build

# Package unpacked distribution folder
pnpm --filter @echo-lingo/desktop run package:dir

# Build Windows NSIS installer
pnpm --filter @echo-lingo/desktop run package:win
```
