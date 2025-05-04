# 定义变量
GO=go
NPM=npm
BINARY_NAME=funcode
FRONTEND_DIR=web/react-router-www
SCRATCH_DIR=web/scratch
BUILD_DIR=build
DIST_DIR=dist
BUILD_FRONTEND ?= false

# 平台相关变量
PLATFORMS=windows linux darwin
ARCHITECTURES=amd64 arm64
WINDOWS_EXT=.exe
GIT_COMMIT := $(shell git rev-parse --short HEAD)
.PHONY: all
all: build-all

# 清理构建文件
.PHONY: clean
clean:
	rm -rf $(BUILD_DIR)
	rm -rf $(FRONTEND_DIR)/$(DIST_DIR)
	rm -rf $(SCRATCH_DIR)/$(DIST_DIR)
	rm -f $(BINARY_NAME)

# 安装 Go 依赖
.PHONY: deps
deps:
	$(GO) mod tidy

# 安装前端依赖
.PHONY: frontend-deps
frontend-deps:

# 构建前端项目
.PHONY: build-frontend
build-frontend: 
	cd $(FRONTEND_DIR) && $(NPM) install
	cd $(FRONTEND_DIR) && $(NPM) run build

# 构建 Scratch 项目
.PHONY: build-scratch
build-scratch: 
	cd $(SCRATCH_DIR) && $(NPM) install
	cd $(SCRATCH_DIR) && BUILD_MODE=dist $(NPM) run build

# 构建指定平台的 Go 项目
.PHONY: build-go-%
build-go-%: deps
	@if [ "$(BUILD_FRONTEND)" = "true" ]; then \
		$(MAKE) build-frontend build-scratch; \
	fi
	@echo "Building for $*"
	$(eval GOOS = $(word 1,$(subst -, ,$*)))
	$(eval GOARCH = $(word 2,$(subst -, ,$*)))
	$(eval EXT = $(if $(filter windows,$(GOOS)),$(WINDOWS_EXT),))
	$(eval CGO_FLAG = 1) # 
	mkdir -p $(BUILD_DIR)/$(GOOS)-$(GOARCH); \
	GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=$(CGO_FLAG) $(GO) build -ldflags "-X 'main.GitCommit=$(GIT_COMMIT)'" -o $(BUILD_DIR)/$(GOOS)-$(GOARCH)/$(BINARY_NAME)_$(GOOS)_$(GOARCH)$(EXT) ./cmd/fun_code	

# 构建所有平台的 Go 项目
.PHONY: build-go-all
build-go-all: $(foreach platform,$(PLATFORMS),$(foreach arch,$(ARCHITECTURES),build-go-$(platform)-$(arch)))

# 构建所有项目
.PHONY: build-all
build-all: build-go-all

# 运行开发服务器
.PHONY: dev
dev:
	air

# 运行前端开发服务器
.PHONY: dev-frontend
dev-frontend:
	cd $(FRONTEND_DIR) && $(NPM) run dev

# 运行 Scratch 开发服务器
.PHONY: dev-scratch
dev-scratch:
	cd $(SCRATCH_DIR) && $(NPM) start

# 运行测试
.PHONY: test
test:
	$(GO) test -v ./...

# 运行前端测试
.PHONY: test-frontend
test-frontend:
	cd $(FRONTEND_DIR) && $(NPM) test

# 运行 Scratch 测试
.PHONY: test-scratch
test-scratch:
	cd $(SCRATCH_DIR) && $(NPM) test

# 格式化代码
.PHONY: fmt
fmt:
	$(GO) fmt ./...
	cd $(FRONTEND_DIR) && $(NPM) run format
	cd $(SCRATCH_DIR) && $(NPM) run format

# 检查代码质量
.PHONY: lint
lint:
	$(GO) vet ./...
	cd $(FRONTEND_DIR) && $(NPM) run lint
	cd $(SCRATCH_DIR) && $(NPM) run lint

# 帮助信息
.PHONY: help
help:
	@echo "可用命令:"
	@echo "  all              - 构建所有平台的项目"
	@echo "  clean            - 清理构建文件"
	@echo "  deps             - 安装 Go 依赖"
	@echo "  frontend-deps    - 安装前端依赖"
	@echo "  build-go-all     - 构建所有平台的 Go 项目（纯 Go 模式，无 CGO）"
	@echo "  build-go-{os}-{arch} - 构建指定平台的 Go 项目（纯 Go 模式，无 CGO）"
	@echo "  build-frontend   - 构建 React 前端"
	@echo "  build-scratch    - 构建 Scratch 项目"
	@echo "  dev              - 运行 Go 开发服务器"
	@echo "  dev-frontend     - 运行前端开发服务器"
	@echo "  dev-scratch      - 运行 Scratch 开发服务器"
	@echo "  test             - 运行 Go 测试"
	@echo "  test-frontend    - 运行前端测试"
	@echo "  test-scratch     - 运行 Scratch 测试"
	@echo "  fmt              - 格式化代码"
	@echo "  lint             - 检查代码质量"
	@echo "  help             - 显示帮助信息"
	@echo ""
	@echo "支持的平台和架构组合:"
	@echo "  windows-amd64    - Windows 64位"
	@echo "  linux-amd64      - Linux 64位"
	@echo "  darwin-amd64     - macOS Intel"
	@echo "  darwin-arm64     - macOS ARM"
	@echo ""
	@echo "构建选项:"
	@echo "  BUILD_FRONTEND=true|false - 控制是否构建前端项目（默认为 false）"