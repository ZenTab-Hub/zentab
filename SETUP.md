# 🚀 Hướng Dẫn Setup MongoDB GUI Client

## 📋 Yêu Cầu Hệ Thống

- **Node.js**: 18.x hoặc cao hơn
- **npm**: 9.x hoặc cao hơn (hoặc yarn/pnpm)
- **Git**: Để clone repository

## 🛠️ Cài Đặt

### Bước 1: Di chuyển vào thư mục project

```bash
cd mongodb-gui-client
```

### Bước 2: Cài đặt dependencies

```bash
npm install
```

**Lưu ý**: Quá trình cài đặt có thể mất vài phút vì cần build native modules (better-sqlite3, electron).

### Bước 3: Cài đặt thêm tailwindcss-animate

```bash
npm install tailwindcss-animate
```

## 🎯 Chạy Ứng Dụng

### Development Mode

```bash
npm run electron:dev
```

Lệnh này sẽ:
1. Khởi động Vite dev server (React app)
2. Tự động mở Electron window
3. Enable hot-reload cho cả React và Electron

### Build Production

```bash
# Build cho platform hiện tại
npm run build

# Build cho Windows
npm run build:win

# Build cho macOS
npm run build:mac

# Build cho Linux
npm run build:linux
```

File build sẽ được tạo trong thư mục `release/`.

## 📁 Cấu Trúc Project

```
mongodb-gui-client/
├── electron/                 # Electron main process
│   ├── main.ts              # Entry point cho Electron
│   └── preload.ts           # Preload script (IPC bridge)
├── src/                     # React application
│   ├── components/          # Reusable components
│   │   ├── common/         # Common UI components
│   │   └── layout/         # Layout components
│   ├── features/           # Feature modules
│   │   ├── connections/    # Connection management
│   │   ├── query-editor/   # Query editor
│   │   ├── data-viewer/    # Data viewer
│   │   ├── aggregation/    # Aggregation builder
│   │   ├── schema-analyzer/# Schema analyzer
│   │   └── import-export/  # Import/Export
│   ├── services/           # Business logic
│   │   ├── mongodb.service.ts
│   │   └── storage.service.ts
│   ├── store/              # State management (Zustand)
│   │   ├── connectionStore.ts
│   │   └── queryStore.ts
│   ├── types/              # TypeScript types
│   ├── utils/              # Utility functions
│   ├── App.tsx             # Main App component
│   ├── main.tsx            # React entry point
│   └── index.css           # Global styles
├── public/                 # Static assets
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

## 🔧 Scripts Có Sẵn

| Script | Mô Tả |
|--------|-------|
| `npm run dev` | Chạy Vite dev server (chỉ React) |
| `npm run electron:dev` | Chạy full app với Electron |
| `npm run build` | Build production |
| `npm run lint` | Chạy ESLint |
| `npm run format` | Format code với Prettier |

## 🎨 Tech Stack

- **Frontend**: React 18 + TypeScript
- **Desktop**: Electron 28
- **Build Tool**: Vite 5
- **UI Framework**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **Code Editor**: Monaco Editor
- **Database**: MongoDB Driver + SQLite (local storage)

## 📝 Các Bước Tiếp Theo

### 1. Implement MongoDB IPC Handlers

Cần implement các IPC handlers trong `electron/main.ts` để xử lý MongoDB operations:

```typescript
// Thêm vào electron/main.ts
import { MongoClient } from 'mongodb'

const connections = new Map<string, MongoClient>()

ipcMain.handle('mongodb:connect', async (_event, connectionString) => {
  const client = new MongoClient(connectionString)
  await client.connect()
  const connectionId = generateId()
  connections.set(connectionId, client)
  return { connectionId }
})

// ... implement các handlers khác
```

### 2. Implement Storage Layer (SQLite)

Tạo file `electron/storage.ts` để quản lý local storage:

```typescript
import Database from 'better-sqlite3'

const db = new Database('mongodb-gui.db')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    name TEXT,
    connectionString TEXT,
    createdAt TEXT
  )
`)
```

### 3. Thêm Monaco Editor

Cài đặt và integrate Monaco Editor vào Query Editor:

```bash
npm install @monaco-editor/react monaco-editor
```

### 4. Implement Connection Manager UI

Tạo form để add/edit connections với validation.

### 5. Implement Query Editor

Integrate Monaco Editor với MongoDB query execution.

## 🐛 Troubleshooting

### Lỗi khi cài đặt better-sqlite3

```bash
npm rebuild better-sqlite3
```

### Lỗi Electron không khởi động

Xóa `node_modules` và cài lại:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Hot reload không hoạt động

Restart dev server:

```bash
# Ctrl+C để stop
npm run electron:dev
```

## 📚 Tài Liệu Tham Khảo

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)

## 🤝 Đóng Góp

Mọi đóng góp đều được chào đón! Hãy tạo issue hoặc pull request.

## 📄 License

MIT

