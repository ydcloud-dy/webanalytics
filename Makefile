APP_NAME    := webanalytics
BIN_DIR     := bin
BINARY      := $(BIN_DIR)/$(APP_NAME)
DOCKER_TAG  ?= $(APP_NAME):latest
FRONTEND    := web
STATIC_DIR  := cmd/server/static/dist

.PHONY: all build build-frontend build-backend run docker clean help

all: build

## build-frontend: 编译前端资源
build-frontend:
	cd $(FRONTEND) && npm ci && npx vite build

## build-backend: 编译后端二进制
build-backend:
	@mkdir -p $(BIN_DIR)
	CGO_ENABLED=0 go build -o $(BINARY) ./cmd/server/

## build: 编译前端 + 后端
build: build-frontend build-backend

## run: 本地运行（需先 make build）
run: build
	$(BINARY)

## docker: 构建 Docker 镜像
docker:
	docker build -t $(DOCKER_TAG) .

## clean: 清理构建产物
clean:
	rm -rf $(BIN_DIR)
	rm -rf $(STATIC_DIR)

## help: 显示帮助
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /'
