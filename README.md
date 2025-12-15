# Starlia ⭐

一个基于 React + Bun 的现代化 AI 聊天应用，支持 **Google Gemini 3 Pro** 模型，具备后端数据持久化、密码认证和多对话管理功能。

## ✨ 主要特性

### 🔐 安全认证
- 简单密码登录，JWT token 认证
- 所有数据安全存储在服务端

### 💬 多对话会话
- 支持创建多个独立对话
- 对话历史自动保存
- 根据第一条消息自动生成对话标题

### 💾 后端持久化
- 支持 **SQLite**（默认）和 **MySQL** 双数据库
- 通过 `DATABASE_URL` 环境变量切换数据库类型
- Docker 部署数据持久化

### 🎨 核心功能
- **Gemini 3 Pro** 多模态交互（文本 + 图片）
- 实时流式响应
- 思维链可视化
- 等待街机模式（贪吃蛇、恐龙跑酷、2048 等）
- 图片历史记录
- 明/暗主题切换

---

## 🚀 部署指南

### 方式一：本地开发

#### 前置要求
- [Bun](https://bun.sh/) >= 1.2.1
- Gemini API Key

#### 启动步骤

1. **克隆仓库**
```bash
git clone https://github.com/eggacheb/Starlia.git
cd Starlia
```

2. **安装依赖**
```bash
bun install
```

3. **启动后端服务器**（终端 1）
```bash
# Windows PowerShell (SQLite 模式 - 默认)
$env:PASSWORD="your_password"; bun run server/index.ts

# Windows PowerShell (MySQL 模式)
$env:PASSWORD="your_password"; $env:DATABASE_URL="mysql://user:pass@host:3306/db"; bun run server/index.ts

# Linux/macOS
PASSWORD=your_password bun run server/index.ts
# 或使用 MySQL
PASSWORD=your_password DATABASE_URL="mysql://user:pass@host:3306/db" bun run server/index.ts
```

4. **启动前端开发服务器**（终端 2）
```bash
bun run dev
```

5. **访问应用**
- 打开浏览器访问 `http://localhost:5173`
- 使用设置的密码登录

---

### 方式二：Docker 部署

#### 使用预构建镜像（推荐）

从 GitHub Container Registry 拉取镜像：

```bash
docker run -d \
  --name starlia \
  -p 8080:80 \
  -v starlia_data:/data \
  -e PASSWORD=your_secure_password \
  ghcr.io/eggacheb/starlia:latest
```

#### 使用 Docker Compose

1. **创建 `docker-compose.yml`**
```yaml
services:
  starlia:
    image: ghcr.io/eggacheb/starlia:latest
    ports:
      - "8080:80"
    volumes:
      - starlia_data:/data
    environment:
      - PASSWORD=your_secure_password
      # 可选：使用 MySQL（不设置则默认使用 SQLite）
      # - DATABASE_URL=mysql://user:password@host:3306/database
    restart: unless-stopped

volumes:
  starlia_data:
```

2. **启动服务**
```bash
docker-compose up -d
```

3. **访问应用**
- 打开浏览器访问 `http://your-server:8080`
- 使用设置的 `PASSWORD` 登录

---

### 方式三：自行构建 Docker 镜像

```bash
# 克隆仓库
git clone https://github.com/eggacheb/Starlia.git
cd Starlia

# 构建镜像
docker build -t starlia .

# 运行容器
docker run -d \
  --name starlia \
  -p 8080:80 \
  -v starlia_data:/data \
  -e PASSWORD=your_password \
  starlia
```

---

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PASSWORD` | `changeme` | 登录密码（**生产环境必须修改**） |
| `PORT` | `80` | 服务端口 |
| `DATA_DIR` | `/data` | 数据库存储目录（仅 SQLite 模式） |
| `DATABASE_URL` | - | MySQL 连接字符串（可选，格式：`mysql://user:pass@host:3306/db`） |
| `JWT_SECRET` | 自动生成 | JWT 签名密钥 |

---

## 📂 项目结构

```
Starlia/
├── server/                   # 后端服务
│   ├── index.ts              # Hono API 服务器
│   └── db.ts                 # SQLite 数据库初始化
├── src/
│   ├── components/           # React 组件
│   │   ├── LoginPage.tsx     # 登录页面
│   │   ├── ChatHistoryPanel.tsx  # 对话历史面板
│   │   ├── ChatInterface.tsx # 聊天界面
│   │   └── ...
│   ├── services/
│   │   ├── apiService.ts     # 后端 API 调用
│   │   └── geminiService.ts  # Gemini API 集成
│   └── store/
│       └── useAppStore.ts    # 状态管理
├── Dockerfile                # Docker 构建文件
├── docker-compose.yml        # Docker Compose 配置
└── .github/workflows/
    └── docker-build.yml      # GitHub Actions 自动构建
```

---

## 🔧 技术栈

- **前端**: React 19 + Vite 6 + TypeScript + Tailwind CSS
- **后端**: Bun + Hono + SQLite
- **部署**: Docker + GitHub Container Registry
- **AI**: Google Gemini SDK

---

##  License

AGPL-3.0

---

## 🙏 致谢

- 原项目：[faithleysath/UndyDraw](https://github.com/faithleysath/UndyDraw)
- API 赞助：[Undy API](https://undyapi.com)
