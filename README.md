# PVC - Prompt Version Control

Track and analyze your AI coding sessions with Codex.

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd pvc

# Install dependencies (if any)
bun install

# Build the executable
bun run build:windows
```

## Usage

```bash
# Initialize PVC in your project
pvc init

# Generate a report for a session
pvc generate report <session-id>
```

## Building

```bash
# Build for Windows
bun run build:windows

# Build for Linux
bun run build:linux

# Build for macOS
bun run build:mac
```

## Project Structure

```
src/
├── index.ts              # CLI entry point
├── commands/             # Command implementations
├── utils/                # Utility functions
├── generators/           # Report generators
└── types/                # TypeScript types
```

## License

MIT

