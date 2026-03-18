# Docker Compose 部署指南

使用 Docker Compose 一键部署 WebAnalytics + ClickHouse。

## 快速开始

```bash
# 克隆项目
git clone https://github.com/ydcloud-dy/webanalytics.git
cd webanalytics

# 复制环境变量模板
cp deploy/docker/.env.example .env

# 编辑 .env，至少修改 JWT_SECRET
vim .env

# 启动
docker compose up -d
```

访问 `http://localhost:8080`。

## 配置

### 环境变量

参考 `deploy/docker/.env.example` 中的所有可配置项。将 `.env` 文件放在项目根目录即可。

### 配置文件

`config/config.yaml` 会自动挂载到容器内。可直接编辑后重启服务：

```bash
docker compose restart webanalytics
```

### GeoIP 地理位置

1. 下载 [GeoLite2-City.mmdb](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)
2. 在 `.env` 中设置：
   ```
   GEOIP_DB_PATH=./data/GeoLite2-City.mmdb
   GEOIP_PATH=/app/data/GeoLite2-City.mmdb
   ```
3. 重启服务

## 常用命令

```bash
# 查看日志
docker compose logs -f webanalytics

# 停止
docker compose down

# 停止并删除数据
docker compose down -v

# 重新构建镜像
docker compose up -d --build
```

## 数据持久化

| Volume | 说明 |
|--------|------|
| `clickhouse_data` | ClickHouse 事件数据 |
| `app_data` | SQLite 元数据（用户、站点等） |
