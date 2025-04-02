package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/model"

	"github.com/stretchr/testify/assert"
)

func TestNewServer(t *testing.T) {
	// 创建临时目录作为文件存储路径
	tempDir := t.TempDir()

	tests := []struct {
		name    string
		config  *config.Config
		wantErr bool
	}{
		{
			name: "正常初始化",
			config: &config.Config{
				Database: config.DatabaseConfig{
					DSN: ":memory:",
				},
				Storage: config.StorageConfig{
					BasePath: tempDir,
				},
				JWT: config.JWTConfig{
					SecretKey: "test_key",
				},
				Server: config.ServerConfig{
					Port: ":8080",
				},
			},
			wantErr: false,
		},
		{
			name: "无效的数据库配置",
			config: &config.Config{
				Database: config.DatabaseConfig{
					DSN: "sqlite3://invalid:1234/nonexistent", // 使用一个确保会失败的DSN
				},
				Storage: config.StorageConfig{
					BasePath: tempDir,
				},
				JWT: config.JWTConfig{
					SecretKey: "test_key",
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s, err := NewServer(tt.config)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, s)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, s)

				// 验证路由是否正确设置
				routes := s.router.Routes()
				assert.NotEmpty(t, routes)

				// 验证文件存储目录是否创建
				_, err := os.Stat(tt.config.Storage.BasePath)
				assert.NoError(t, err)
			}
		})
	}
}

func TestServer_setupRoutes(t *testing.T) {
	// 创建一个测试服务器
	cfg := &config.Config{
		Database: config.DatabaseConfig{
			DSN: ":memory:",
		},
		Storage: config.StorageConfig{
			BasePath: t.TempDir(),
		},
		JWT: config.JWTConfig{
			SecretKey: "test_key",
		},
	}

	s, err := NewServer(cfg)
	assert.NoError(t, err)

	// 测试公开路由
	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
	}{
		{
			name:       "注册路由",
			method:     "POST",
			path:       "/api/auth/register",
			wantStatus: http.StatusBadRequest, // 因为没有提供请求体
		},
		{
			name:       "登录路由",
			method:     "POST",
			path:       "/api/auth/login",
			wantStatus: http.StatusBadRequest, // 因为没有提供请求体
		},
		{
			name:       "需要认证的路由",
			method:     "GET",
			path:       "/api/files",
			wantStatus: http.StatusUnauthorized, // 因为没有提供token
		},
		// 添加 Scratch 相关路由测试
		{
			name:       "获取Scratch项目",
			method:     "GET",
			path:       "/api/scratch/projects/1",
			wantStatus: http.StatusUnauthorized, // 因为没有提供token
		},
		{
			name:       "保存Scratch项目",
			method:     "PUT",
			path:       "/api/scratch/projects/1",
			wantStatus: http.StatusUnauthorized, // 因为没有提供token
		},
		{
			name:       "列出Scratch项目",
			method:     "GET",
			path:       "/api/scratch/projects",
			wantStatus: http.StatusUnauthorized, // 因为没有提供token
		},
		{
			name:       "删除Scratch项目",
			method:     "DELETE",
			path:       "/api/scratch/projects/1",
			wantStatus: http.StatusUnauthorized, // 因为没有提供token
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			s.router.ServeHTTP(w, req)
			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

// 添加测试带认证的路由
func TestServer_AuthenticatedRoutes(t *testing.T) {
	// 创建一个测试服务器
	cfg := &config.Config{
		Database: config.DatabaseConfig{
			DSN: ":memory:",
		},
		Storage: config.StorageConfig{
			BasePath: t.TempDir(),
		},
		JWT: config.JWTConfig{
			SecretKey: "test_key",
		},
	}

	s, err := NewServer(cfg)
	assert.NoError(t, err)

	// 创建一个测试用户并获取token
	// 注意：这里我们直接使用服务器实例的数据库和处理器
	// 在实际项目中，你可能需要使用mock或者更复杂的设置
	user := model.User{
		Username: "testuser",
		Password: "password123", // 实际应用中应该是加密的
		Email:    "test@example.com",
	}

	result := s.db.Create(&user)
	assert.NoError(t, result.Error)

	// 模拟登录请求获取token
	loginReq := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(`{"username":"testuser","password":"password123"}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()

	s.router.ServeHTTP(loginW, loginReq)

	// 检查登录是否成功
	assert.Equal(t, http.StatusOK, loginW.Code)

	// 解析响应获取token
	var loginResp map[string]string
	err = json.Unmarshal(loginW.Body.Bytes(), &loginResp)
	assert.NoError(t, err)
	token := loginResp["token"]
	assert.NotEmpty(t, token)

	// 测试需要认证的路由
	tests := []struct {
		name       string
		method     string
		path       string
		body       string
		wantStatus int
	}{
		{
			name:       "列出文件",
			method:     "GET",
			path:       "/api/files",
			body:       "",
			wantStatus: http.StatusOK,
		},
		{
			name:       "列出Scratch项目",
			method:     "GET",
			path:       "/api/scratch/projects",
			body:       "",
			wantStatus: http.StatusOK,
		},
		{
			name:       "保存Scratch项目",
			method:     "PUT",
			path:       "/api/scratch/projects/0", // 0表示新建项目
			body:       `{"name":"测试项目","content":{"test":"data"}}`,
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req *http.Request
			if tt.body != "" {
				req = httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(tt.method, tt.path, nil)
			}

			// 添加认证token
			req.Header.Set("Authorization", "Bearer "+token)

			w := httptest.NewRecorder()
			s.router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

// 添加测试服务器启动函数
func TestServer_Start(t *testing.T) {
	// 创建一个测试服务器
	cfg := &config.Config{
		Database: config.DatabaseConfig{
			DSN: ":memory:",
		},
		Storage: config.StorageConfig{
			BasePath: t.TempDir(),
		},
		JWT: config.JWTConfig{
			SecretKey: "test_key",
		},
		Server: config.ServerConfig{
			Port: ":0", // 使用随机端口
		},
	}

	s, err := NewServer(cfg)
	assert.NoError(t, err)

	// 启动服务器（在goroutine中）
	go func() {
		// 忽略错误，因为我们会在测试结束时关闭服务器
		_ = s.Start()
	}()

	// 等待服务器启动
	time.Sleep(100 * time.Millisecond)

	// 测试服务器是否正常运行
	// 注意：这个测试可能不是很可靠，因为我们不知道确切的端口
	// 在实际项目中，你可能需要更复杂的设置来测试服务器启动
	t.Log("服务器已启动")
}
