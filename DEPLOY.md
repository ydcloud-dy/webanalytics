# WebAnalytics 部署指南

WebAnalytics 支持三种部署方式，请根据实际场景选择。

## 部署方式对比

| 方式 | 适用场景 | 复杂度 |
|------|---------|--------|
| [裸部署](#裸部署) | 单机、开发/测试环境 | 低 |
| [Docker Compose](#docker-compose) | 单机生产、快速验证 | 低 |
| [Kubernetes Helm](#kubernetes-helm) | 集群化生产环境 | 中 |

## 裸部署

直接在物理机或虚拟机上编译运行，需要自行安装 ClickHouse。

详见 [deploy/bare/README.md](deploy/bare/README.md)

```bash
make build
./bin/webanalytics
```

## Docker Compose

一键启动 WebAnalytics + ClickHouse，推荐大多数用户使用。

详见 [deploy/docker/README.md](deploy/docker/README.md)

```bash
cp deploy/docker/.env.example .env
docker compose up -d
```

## Kubernetes Helm

使用 Helm Chart 部署到 Kubernetes 集群，支持内置或外部 ClickHouse。

详见 [deploy/helm/webanalytics/values.yaml](deploy/helm/webanalytics/values.yaml)

```bash
# 使用内置 ClickHouse
helm install my-analytics ./deploy/helm/webanalytics

# 使用外部 ClickHouse
helm install my-analytics ./deploy/helm/webanalytics \
  --set clickhouse.enabled=false \
  --set clickhouse.externalDSN="clickhouse://user:pass@ch-host:9000/webanalytics"
```

## 构建工具

项目提供 Makefile 简化构建流程：

```bash
make build            # 编译前端 + 后端
make build-frontend   # 仅编译前端
make build-backend    # 仅编译后端
make docker           # 构建 Docker 镜像
make run              # 编译并运行
make clean            # 清理构建产物
```
