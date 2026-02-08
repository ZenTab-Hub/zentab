# MongoDB GUI Client

A modern, feature-rich MongoDB GUI client built with Electron, React, and TypeScript.

## Features

- 🔌 **Connection Management**: Support for Standalone, Replica Set, and Sharded Clusters
- 📝 **Query Editor**: IntelliSense, syntax highlighting, and query history
- 🎨 **Visual Query Builder**: Drag-and-drop interface for building queries
- 📊 **Aggregation Pipeline Builder**: Visual pipeline creation with stage-by-stage preview
- 📋 **Data Viewer**: Table, Tree, and JSON views with inline editing
- 🔍 **Schema Analyzer**: Auto-detect schema and get insights
- 📥 **Import/Export**: Support for JSON, CSV, Excel, and more
- 🚀 **Index Management**: Create, analyze, and optimize indexes

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Desktop**: Electron
- **UI**: Tailwind CSS + Shadcn/ui
- **Editor**: Monaco Editor
- **State**: Zustand + React Query
- **Database**: MongoDB Driver + SQLite (local storage)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for production
npm run build
```

## Project Structure

```
mongodb-gui-client/
├── electron/           # Electron main process
├── src/               # React application
│   ├── components/    # Reusable components
│   ├── features/      # Feature modules
│   ├── services/      # Business logic
│   ├── store/         # State management
│   ├── types/         # TypeScript types
│   └── utils/         # Utility functions
├── public/            # Static assets
└── tests/             # Test files
```

## Development

```bash
# Run development server
npm run dev

# Run Electron in dev mode
npm run electron:dev

# Lint code
npm run lint

# Format code
npm run format
```

## Building

```bash
# Build for current platform
npm run build

# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

## License

MIT

