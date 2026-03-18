# WebAnalytics

轻量级、隐私友好的开源网站分析平台。无 Cookie 追踪，实时数据仪表盘，完整的 RBAC 权限管理。

## 功能特性

### 数据采集
- **无 Cookie 追踪** — 基于 UA + 屏幕分辨率 + 日期的哈希生成每日轮换访客 ID，无需 Cookie 同意弹窗
- **轻量 SDK** — 追踪脚本约 3KB，支持 `sendBeacon` 和 XHR 双通道
- **SPA 支持** — 自动监听 `pushState` / `popstate`，适配 React / Vue / Angular 等单页应用
- **页面性能采集** — 集成 Navigation Timing API，自动采集网络、服务器、DOM 处理等各阶段耗时
- **页面停留时长** — 基于 `visibilitychange` 事件精确追踪用户停留时间
- **UTM 参数** — 自动解析 `utm_source`、`utm_medium`、`utm_campaign`、`utm_term`、`utm_content`
- **自定义事件** — 通过 `window.wa.track(name, value, props)` 追踪自定义业务事件
- **GeoIP 地理定位** — 可选集成 MaxMind GeoLite2 数据库，精确到国家/地区/城市

### 数据分析
- **实时仪表盘** — 当前在线访客数、实时页面浏览、QPS 趋势
- **概览面板** — PV、UV、会话数、跳出率、平均停留时长等核心指标
- **访客趋势** — 按小时/天粒度的时序折线图
- **流量来源** — 渠道分布（直接、搜索、社交、引荐等）
- **地理分布** — 交互式世界地图 + 国家/地区排行表
- **设备与软件** — 浏览器、操作系统、设备类型、屏幕分辨率统计
- **页面分析** — Top 页面排行，浏览量、唯一访客、跳出率、平均停留时间
- **来源站点** — 外部引荐流量明细
- **访问时间** — 按小时的访客热力分布
- **性能分析** — 页面加载各阶段耗时趋势图、按页面 URL 的性能排行
- **忠诚度** — 新/回访用户对比，访问频次分布，停留时长分布

### 权限管理 (RBAC)
- **双层角色模型** — 全局角色 (`admin` / `user`) + 站点角色 (`owner` / `viewer`)
- **管理员功能** — 用户增删改查、密码重置、站点创建/删除、成员分配
- **普通用户** — 只能查看被分配的站点数据
- **公开注册关闭** — 仅管理员可创建用户账号

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Go 1.25、Chi (HTTP 路由)、JWT 认证、bcrypt 密码加密 |
| 前端 | React 18、TypeScript、Vite、Tailwind CSS、Recharts、React Router v6、TanStack Query |
| 分析数据库 | ClickHouse 24.1 (事件存储，物化视图预聚合) |
| 元数据库 | SQLite (用户、站点、成员关系) |
| 地理定位 | MaxMind GeoLite2 (可选) |
| 部署 | Docker Compose、Kubernetes Helm |

## 架构概览

```
┌──────────────┐     ┌──────────────────────────────────────────────┐
│   用户浏览器   │     │              WebAnalytics Server              │
│              │     │                                              │
│  tracker.js ─┼────▶│  /api/collect ──▶ Buffer ──▶ ClickHouse     │
│              │     │                            (事件/分析数据)     │
│  React SPA  ─┼────▶│  /api/dashboard/* ◀── Query ◀── ClickHouse  │
│              │     │  /api/auth/*     ◀── Auth  ◀── SQLite       │
│              │     │  /api/admin/*         (用户/站点/成员)         │
│              │     │  /api/sites/*                                │
└──────────────┘     └──────────────────────────────────────────────┘
```

**数据流：**
1. 追踪 SDK 向 `/api/collect` 发送事件 (pageview / event / leave / performance)
2. 服务端解析 UA、查询 GeoIP、提取 UTM 参数
3. 事件进入内存缓冲区，定时批量写入 ClickHouse (默认 5 秒 / 5000 条)
4. 仪表盘通过 React Query 请求 `/api/dashboard/*` 接口
5. 后端查询 ClickHouse 物化视图返回聚合数据

## 快速开始

### 环境要求
- Go 1.25+
- Node.js 18+
- ClickHouse 24.1+
- (可选) MaxMind GeoLite2-City.mmdb

### 方式一：Docker Compose (推荐)

```bash
git clone https://github.com/ydcloud-dy/webanalytics.git
cd webanalytics

# 编辑配置 (可选)
cp deploy/docker/.env.example .env
vim .env

# 启动
docker compose up -d
```

服务将在 `http://localhost:8080` 启动。

### 方式二：本地编译

```bash
git clone https://github.com/ydcloud-dy/webanalytics.git
cd webanalytics

# 确保 ClickHouse 已启动
# 创建数据库
clickhouse-client -q "CREATE DATABASE IF NOT EXISTS webanalytics"

# 编译前端 + 后端
make build

# 启动
./bin/webanalytics
```

### 方式三：分步编译

```bash
# 编译前端
cd web && npm ci && npx vite build && cd ..

# 编译后端
CGO_ENABLED=0 go build -o bin/webanalytics ./cmd/server/

# 启动
./bin/webanalytics
```

### 默认管理员

首次启动时自动创建管理员账号：

| 字段 | 值 |
|------|------|
| 邮箱 | `admin@webanalytics.local` |
| 密码 | `admin123` |

> **请登录后立即修改密码。**

## 配置说明

配置文件：`config/config.yaml`，环境变量优先级高于配置文件。

```yaml
server:
  port: "7777"              # 监听端口
  cors_allow_all: true      # CORS 全部放行

database:
  clickhouse_dsn: "clickhouse://default:@localhost:9000/webanalytics"
  sqlite_path: "data/webanalytics.db"

auth:
  jwt_secret: "change-me-in-production"   # JWT 签名密钥

tracking:
  buffer_size: 5000           # 事件缓冲区大小
  flush_interval_sec: 5       # 缓冲区刷新间隔 (秒)
  geoip_path: ""              # GeoLite2-City.mmdb 路径 (留空禁用)

timezone: "Asia/Shanghai"
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 监听端口 | `7777` |
| `CLICKHOUSE_DSN` | ClickHouse 连接串 | `clickhouse://default:@localhost:9000/webanalytics` |
| `SQLITE_PATH` | SQLite 文件路径 | `data/webanalytics.db` |
| `JWT_SECRET` | JWT 签名密钥 | `change-me-in-production` |
| `GEOIP_PATH` | GeoIP 数据库路径 | (空，禁用) |
| `TZ` | 时区 | `Asia/Shanghai` |

## SDK 接入

### 基本接入

在被追踪网站的 `<head>` 或 `<body>` 中添加：

```html
<script defer data-site-id="YOUR_TRACKING_ID" src="https://your-domain.com/sdk/tracker.js"></script>
```

`YOUR_TRACKING_ID` 是站点创建后生成的追踪 ID (格式：`wa_xxxx`)。

### 自定义事件

```javascript
// 追踪按钮点击
window.wa.track('button_click', 1, { button: 'signup' })

// 追踪购买事件
window.wa.track('purchase', 99.9, { product: 'Pro Plan' })
```

### 手动追踪页面

```javascript
// SPA 场景下手动触发页面追踪
window.wa.pageview()
```

## API 文档

### 认证

所有 `/api/*` 接口 (除 `/api/collect`、`/api/auth/login`) 需要 Bearer Token：

```
Authorization: Bearer <jwt_token>
```

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 登录，返回 JWT Token |
| `GET` | `/api/auth/me` | 获取当前用户信息 |
| `POST` | `/api/auth/refresh` | 刷新 Token |

**登录请求：**
```json
POST /api/auth/login
{ "email": "admin@webanalytics.local", "password": "admin123" }
```

**响应：**
```json
{ "token": "eyJhbGciOiJIUzI1NiIs..." }
```

### 站点管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/sites` | 站点列表 | admin 全部, user 已分配 |
| `POST` | `/api/sites` | 创建站点 | admin |
| `GET` | `/api/sites/{siteId}` | 获取站点详情 | 已分配 |
| `PUT` | `/api/sites/{siteId}` | 更新站点 | admin / owner |
| `DELETE` | `/api/sites/{siteId}` | 删除站点 | admin |

### 数据分析

所有数据接口均支持 `from` 和 `to` 查询参数 (格式：`YYYY-MM-DD`)。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/dashboard/{siteId}/overview` | 核心指标概览 |
| `GET` | `/api/dashboard/{siteId}/timeseries` | 时序数据 (支持 `interval` 参数: hour/day) |
| `GET` | `/api/dashboard/{siteId}/channels` | 流量渠道分布 |
| `GET` | `/api/dashboard/{siteId}/browsers` | 浏览器统计 |
| `GET` | `/api/dashboard/{siteId}/devices` | 设备类型统计 |
| `GET` | `/api/dashboard/{siteId}/os` | 操作系统统计 |
| `GET` | `/api/dashboard/{siteId}/geo` | 地理位置分布 |
| `GET` | `/api/dashboard/{siteId}/pages` | Top 页面 |
| `GET` | `/api/dashboard/{siteId}/pages-ext` | 扩展页面数据 (含跳出率、停留时间) |
| `GET` | `/api/dashboard/{siteId}/referrers` | 来源站点 |
| `GET` | `/api/dashboard/{siteId}/screen-resolutions` | 屏幕分辨率 |
| `GET` | `/api/dashboard/{siteId}/hourly-visitors` | 每小时访客数 |
| `GET` | `/api/dashboard/{siteId}/realtime` | 实时在线人数 |
| `GET` | `/api/dashboard/{siteId}/realtime-overview` | 实时概览 |
| `GET` | `/api/dashboard/{siteId}/realtime-stats` | 实时统计 |
| `GET` | `/api/dashboard/{siteId}/qps-trend` | QPS 趋势 |
| `GET` | `/api/dashboard/{siteId}/recent-visits` | 最近访问记录 |
| `GET` | `/api/dashboard/{siteId}/loyalty` | 忠诚度数据 |
| `GET` | `/api/dashboard/{siteId}/performance-overview` | 性能概览 |
| `GET` | `/api/dashboard/{siteId}/performance-timeseries` | 性能趋势 |
| `GET` | `/api/dashboard/{siteId}/page-performance` | 按页面性能 |

### 管理接口 (仅 admin)

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/users` | 用户列表 |
| `POST` | `/api/admin/users` | 创建用户 |
| `PUT` | `/api/admin/users/{userId}` | 编辑用户 (邮箱/角色) |
| `DELETE` | `/api/admin/users/{userId}` | 删除用户 |
| `PUT` | `/api/admin/users/{userId}/password` | 重置密码 |
| `GET` | `/api/admin/sites/{siteId}/members` | 站点成员列表 |
| `POST` | `/api/admin/sites/{siteId}/members` | 添加站点成员 |
| `DELETE` | `/api/admin/sites/{siteId}/members/{userId}` | 移除站点成员 |
| `POST` | `/api/admin/batch-members` | 批量添加成员 |
| `POST` | `/api/admin/batch-members/remove` | 批量移除成员 |

### 数据采集

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/collect` | 接收追踪事件 (限流 100 次/分钟) |
| `GET` | `/api/collect` | 1x1 像素追踪回退 |
| `GET` | `/sdk/tracker.js` | 追踪 SDK (缓存 1 小时) |
| `GET` | `/api/health` | 健康检查 |

## 数据库设计

### ClickHouse — 事件表

```sql
CREATE TABLE events (
    site_id       UInt32,
    event_type    String,       -- pageview | event | leave | performance
    timestamp     DateTime64(3, 'Asia/Shanghai'),
    session_id    String,
    visitor_id    String,
    pathname      String,
    hostname      String,
    referrer      String,
    referrer_source String,     -- direct | organic | social | referral | ...
    utm_source    String,
    utm_medium    String,
    utm_campaign  String,
    utm_term      String,
    utm_content   String,
    browser       String,
    browser_version String,
    os            String,
    os_version    String,
    device_type   String,       -- desktop | mobile | tablet | bot
    country       String,
    region        String,
    city          String,
    screen_width  UInt16,
    screen_height UInt16,
    duration      Float64,
    event_name    String,
    event_value   Float64,
    props         String,
    -- 性能字段
    network_time    Float64,
    server_time     Float64,
    transfer_time   Float64,
    dom_processing  Float64,
    dom_complete    Float64,
    on_load_time    Float64,
    page_load_time  Float64
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (site_id, event_type, timestamp, visitor_id)
TTL timestamp + INTERVAL 2 YEAR
```

自动创建物化视图用于预聚合：`daily_stats_mv`、`hourly_stats_mv`、`channel_stats_mv`、`geo_stats_mv`。

### SQLite — 元数据表

```sql
-- 用户
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'user',   -- admin | user
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 站点
CREATE TABLE sites (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    domain        TEXT NOT NULL,
    name          TEXT,
    tracking_id   TEXT UNIQUE,           -- wa_xxxx
    timezone      TEXT DEFAULT 'Asia/Shanghai',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 站点成员
CREATE TABLE site_members (
    user_id  INTEGER REFERENCES users(id),
    site_id  INTEGER REFERENCES sites(id),
    role     TEXT DEFAULT 'viewer',      -- owner | viewer
    PRIMARY KEY (user_id, site_id)
);
```

## 项目结构

```
webanalytics/
├── cmd/server/
│   ├── main.go                 # 程序入口
│   └── static/
│       ├── tracker.js          # 追踪 SDK (运行时)
│       └── dist/               # 前端构建产物
├── internal/
│   ├── auth/                   # 认证服务 (JWT、用户管理)
│   ├── config/                 # 配置加载 (YAML + 环境变量)
│   ├── middleware/             # HTTP 中间件 (CORS、限流)
│   ├── query/                  # 分析查询 (ClickHouse)
│   ├── site/                   # 站点管理 (CRUD、成员)
│   ├── store/                  # 数据层 (ClickHouse、SQLite)
│   └── tracking/               # 事件采集 (解析、缓冲、批量写入)
├── web/                        # React 前端
│   ├── src/
│   │   ├── pages/              # 页面组件
│   │   ├── components/         # 通用 UI 组件
│   │   ├── contexts/           # React Context (认证、主题)
│   │   ├── lib/                # API 客户端
│   │   ├── App.tsx             # 路由配置
│   │   └── main.tsx            # 入口
│   ├── package.json
│   └── tailwind.config.js
├── sdk/
│   └── tracker.js              # 追踪 SDK 源码
├── config/
│   └── config.yaml             # 配置模板
├── deploy/
│   ├── docker/                 # Docker 部署
│   ├── bare/                   # 裸机部署
│   └── helm/                   # Kubernetes Helm Chart
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── go.mod
```

## Makefile 命令

```bash
make build            # 编译前端 + 后端
make build-frontend   # 仅编译前端
make build-backend    # 仅编译后端
make run              # 编译并运行
make docker           # 构建 Docker 镜像
make clean            # 清理构建产物
make help             # 显示帮助
```

## 权限矩阵

| 操作 | admin | user (owner) | user (viewer) |
|------|:-----:|:------------:|:-------------:|
| 创建/删除站点 | ✅ | - | - |
| 修改站点设置 | ✅ | ✅ | - |
| 查看站点数据 | ✅ | ✅ | ✅ |
| 管理站点成员 | ✅ | - | - |
| 管理用户 | ✅ | - | - |

## GeoIP 配置

如需地理位置功能，需要 MaxMind GeoLite2-City 数据库：

1. 在 [MaxMind](https://www.maxmind.com/) 注册账号
2. 下载 GeoLite2-City.mmdb
3. 配置路径：
   ```yaml
   tracking:
     geoip_path: "/path/to/GeoLite2-City.mmdb"
   ```
   或设置环境变量：
   ```bash
   GEOIP_PATH=/path/to/GeoLite2-City.mmdb
   ```

## 生产部署注意事项

1. **修改 JWT 密钥** — 务必修改 `jwt_secret`，不要使用默认值
2. **修改管理员密码** — 首次登录后立即修改默认密码
3. **ClickHouse 密码** — 生产环境为 ClickHouse 设置密码
4. **HTTPS** — 建议使用 Nginx/Caddy 反向代理并配置 SSL 证书
5. **备份** — 定期备份 SQLite 数据库文件和 ClickHouse 数据
6. **限流** — 事件采集接口默认限流 100 次/分钟，可根据流量调整

## License

MIT
