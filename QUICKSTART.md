# ⚡ Quick Start Guide

## 🎉 Chúc mừng! Project đã được setup thành công!

Bạn đã có một project MongoDB GUI Client hoàn chỉnh với:
- ✅ Electron + React + TypeScript
- ✅ Tailwind CSS + UI Components
- ✅ State Management (Zustand)
- ✅ Service Layer Architecture
- ✅ Basic Layout & Navigation

## 🚀 Bắt Đầu Ngay

### 1️⃣ Cài đặt Dependencies

```bash
cd mongodb-gui-client
npm install
```

**Lưu ý**: Cài đặt có thể mất 3-5 phút do cần build native modules.

### 2️⃣ Chạy Development Mode

```bash
npm run electron:dev
```

Ứng dụng sẽ tự động mở trong Electron window! 🎊

## 📂 Cấu Trúc Project

```
mongodb-gui-client/
├── 📱 electron/              # Electron main process
│   ├── main.ts              # Entry point
│   └── preload.ts           # IPC bridge
│
├── ⚛️ src/                   # React application
│   ├── components/          # UI Components
│   │   ├── common/         # Button, Input, etc.
│   │   └── layout/         # MainLayout, Sidebar, Header
│   │
│   ├── features/           # Feature modules
│   │   ├── connections/    # ✅ Connection management
│   │   ├── query-editor/   # ✅ Query editor
│   │   ├── data-viewer/    # ✅ Data viewer
│   │   ├── aggregation/    # ✅ Aggregation builder
│   │   ├── schema-analyzer/# ✅ Schema analyzer
│   │   └── import-export/  # ✅ Import/Export
│   │
│   ├── services/           # Business logic
│   │   ├── mongodb.service.ts
│   │   └── storage.service.ts
│   │
│   ├── store/              # State management
│   │   ├── connectionStore.ts
│   │   └── queryStore.ts
│   │
│   ├── types/              # TypeScript types
│   └── utils/              # Utilities
│
├── 📄 Configuration Files
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tailwind.config.js
│
└── 📚 Documentation
    ├── README.md
    ├── SETUP.md
    ├── ROADMAP.md
    └── QUICKSTART.md (this file)
```

## 🎯 Các Bước Tiếp Theo

### Phase 1: Implement Connection Manager (Ưu tiên cao nhất)

#### Step 1: Tạo SQLite Storage Handler

Tạo file `electron/storage.ts`:

```typescript
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

const dbPath = path.join(app.getPath('userData'), 'mongodb-gui.db')
const db = new Database(dbPath)

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    connectionString TEXT NOT NULL,
    host TEXT,
    port INTEGER,
    createdAt TEXT,
    updatedAt TEXT
  )
`)

export const storage = {
  saveConnection: (conn: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO connections 
      (id, name, connectionString, host, port, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    return stmt.run(
      conn.id, conn.name, conn.connectionString, 
      conn.host, conn.port, conn.createdAt, conn.updatedAt
    )
  },
  
  getConnections: () => {
    return db.prepare('SELECT * FROM connections').all()
  },
  
  deleteConnection: (id: string) => {
    return db.prepare('DELETE FROM connections WHERE id = ?').run(id)
  }
}
```

#### Step 2: Implement MongoDB IPC Handlers

Thêm vào `electron/main.ts`:

```typescript
import { MongoClient } from 'mongodb'
import { storage } from './storage'

const connections = new Map<string, MongoClient>()

// Connection handlers
ipcMain.handle('mongodb:connect', async (_event, connectionString) => {
  try {
    const client = new MongoClient(connectionString)
    await client.connect()
    const connectionId = Date.now().toString()
    connections.set(connectionId, client)
    return { connectionId, success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('mongodb:listDatabases', async (_event, connectionId) => {
  const client = connections.get(connectionId)
  if (!client) throw new Error('Connection not found')
  const result = await client.db().admin().listDatabases()
  return result.databases
})

// Storage handlers
ipcMain.handle('storage:saveConnection', async (_event, connection) => {
  return storage.saveConnection(connection)
})

ipcMain.handle('storage:getConnections', async () => {
  return storage.getConnections()
})
```

#### Step 3: Create Connection Form UI

Tạo `src/features/connections/components/ConnectionForm.tsx`:

```typescript
import { useState } from 'react'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'

export const ConnectionForm = ({ onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    host: 'localhost',
    port: 27017,
    username: '',
    password: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Build connection string
    const connectionString = `mongodb://${formData.username}:${formData.password}@${formData.host}:${formData.port}`
    
    const connection = {
      id: Date.now().toString(),
      name: formData.name,
      connectionString,
      host: formData.host,
      port: formData.port,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    await window.electronAPI.storage.saveConnection(connection)
    onSave(connection)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        placeholder="Connection Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      {/* Add more fields... */}
      <Button type="submit">Save Connection</Button>
    </form>
  )
}
```

### Phase 2: Implement Query Editor

1. Install Monaco Editor: `npm install @monaco-editor/react`
2. Create MonacoQueryEditor component
3. Implement query execution
4. Display results

### Phase 3: Implement Data Viewer

1. Install TanStack Table: `npm install @tanstack/react-table`
2. Create TableView component
3. Implement CRUD operations
4. Add pagination

## 🛠️ Useful Commands

```bash
# Development
npm run electron:dev      # Run app in dev mode
npm run dev              # Run only React (for UI development)

# Code Quality
npm run lint             # Check for linting errors
npm run format           # Format code with Prettier

# Build
npm run build            # Build for production
npm run build:win        # Build for Windows
npm run build:mac        # Build for macOS
npm run build:linux      # Build for Linux
```

## 📚 Tài Liệu Tham Khảo

- **SETUP.md**: Hướng dẫn cài đặt chi tiết
- **ROADMAP.md**: Lộ trình phát triển đầy đủ
- **README.md**: Tổng quan về project

## 💡 Tips

1. **Hot Reload**: Mọi thay đổi trong `src/` sẽ tự động reload
2. **DevTools**: Electron DevTools tự động mở trong dev mode
3. **Debugging**: Sử dụng `console.log()` hoặc breakpoints trong DevTools
4. **State**: Sử dụng Zustand stores để quản lý state global

## 🐛 Common Issues

**Q: Electron không khởi động?**
A: Chạy `npm install` lại và đảm bảo Node.js >= 18

**Q: Lỗi better-sqlite3?**
A: Chạy `npm rebuild better-sqlite3`

**Q: Port 5173 đã được sử dụng?**
A: Thay đổi port trong `vite.config.ts`

## 🎊 Chúc Bạn Code Vui Vẻ!

Nếu cần hỗ trợ, hãy tham khảo:
- GitHub Issues
- Stack Overflow
- MongoDB Documentation
- Electron Documentation

