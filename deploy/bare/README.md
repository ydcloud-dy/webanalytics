# 裸部署指南

直接在物理机或虚拟机上运行 WebAnalytics。

## 前置依赖

| 组件 | 最低版本 | 说明 |
|------|---------|------|
| Go | 1.23+ | 编译后端 |
| Node.js | 18+ | 编译前端 |
| ClickHouse | 24+ | 事件数据存储 |
| GeoIP 数据库 | — | 可选，用于地理位置功能 |

## 1. 安装 ClickHouse

**Ubuntu / Debian：**

```bash
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
curl -fsSL https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml.key | sudo gpg --dearmor -o /usr/share/keyrings/clickhouse-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/clickhouse-keyring.gpg] https://packages.clickhouse.com/deb stable main" | sudo tee /etc/apt/sources.list.d/clickhouse.list
sudo apt-get update
sudo apt-get install -y clickhouse-server clickhouse-client
sudo systemctl enable --now clickhouse-server
```

**CentOS / RHEL：**

```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://packages.clickhouse.com/rpm/clickhouse.repo
sudo yum install -y clickhouse-server clickhouse-client
sudo systemctl enable --now clickhouse-server
```

**macOS（开发用）：**

```bash
brew install clickhouse
clickhouse server --daemon
```

创建数据库：

```bash
clickhouse-client -q "CREATE DATABASE IF NOT EXISTS webanalytics"
```

## 2. 可选：GeoIP 数据库

从 [MaxMind](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) 下载 GeoLite2-City.mmdb，放置到 `data/` 目录下。

```bash
mkdir -p /opt/webanalytics/data
cp GeoLite2-City.mmdb /opt/webanalytics/data/
```

## 3. 构建

```bash
git clone https://github.com/ydcloud-dy/webanalytics.git
cd webanalytics
make build
```

构建产物位于 `bin/webanalytics`。

## 4. 配置

复制并修改配置文件：

```bash
sudo mkdir -p /opt/webanalytics/data
sudo cp bin/webanalytics /opt/webanalytics/
sudo cp config/config.yaml /opt/webanalytics/config.yaml
```

编辑 `/opt/webanalytics/config.yaml`，根据实际环境修改 ClickHouse DSN、JWT Secret 等。

## 5. 启动

### 手动启动

```bash
cd /opt/webanalytics
./webanalytics
```

### systemd 托管（推荐）

```bash
# 创建系统用户
sudo useradd -r -s /sbin/nologin webanalytics

# 设置目录权限
sudo chown -R webanalytics:webanalytics /opt/webanalytics

# 安装 service 文件
sudo cp deploy/bare/webanalytics.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now webanalytics

# 查看状态
sudo systemctl status webanalytics
sudo journalctl -u webanalytics -f
```

## 6. 生产建议

### 反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name analytics.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### TLS

建议使用 Let's Encrypt + Certbot 自动签发证书，或在反向代理层配置 TLS。

### 日志

```bash
# 查看应用日志
sudo journalctl -u webanalytics --since today

# ClickHouse 日志
sudo journalctl -u clickhouse-server --since today
```
