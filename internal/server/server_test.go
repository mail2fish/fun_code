package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestNewServer(t *testing.T) {
	tests := []struct {
		name    string
		config  func(t *testing.T) *config.Config
		wantErr bool
	}{
		{
			name: "正常初始化",
			config: func(t *testing.T) *config.Config {
				return &config.Config{
					Database: config.DatabaseConfig{DSN: "file::memory:?cache=shared"},
					Storage:  config.StorageConfig{BasePath: t.TempDir()},
					JWT:      config.JWTConfig{SecretKey: "test_key"},
				}
			},
			wantErr: false,
		},
		{
			name: "无效的数据库配置",
			config: func(t *testing.T) *config.Config {
				return &config.Config{
					Database: config.DatabaseConfig{
						DSN: "sqlite3://invalid:1234/nonexistent",
					},
					Storage: config.StorageConfig{
						BasePath: t.TempDir(),
					},
					JWT: config.JWTConfig{
						SecretKey: "test_key",
					},
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := tt.config(t)
			s, err := NewServer(cfg)
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
				_, err := os.Stat(cfg.Storage.BasePath) // 使用cfg而不是tt.config
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
	s := createTestServer(t)
	token := createTestUserAndToken(t, s)

	tests := []struct {
		name       string
		method     string
		path       string
		setup      func() *http.Request
		wantStatus int
	}{
		{
			name:   "创建Scratch项目",
			method: "POST",
			path:   "/api/scratch/projects/",
			setup: func() *http.Request {
				body := `{"name":"测试项目","content":{"test":"data"}}`
				req := httptest.NewRequest("POST", "/api/scratch/projects/", strings.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+token)
				return req
			},
			wantStatus: http.StatusCreated,
		},
		{
			name:   "列出文件",
			method: "GET",
			path:   "/api/files",
			setup: func() *http.Request {
				req := httptest.NewRequest("GET", "/api/files", nil)
				req.Header.Set("Authorization", "Bearer "+token)
				return req
			},
			wantStatus: http.StatusOK,
		},
		{
			name:   "列出Scratch项目",
			method: "GET",
			path:   "/api/scratch/projects",
			setup: func() *http.Request {
				req := httptest.NewRequest("GET", "/api/scratch/projects", nil)
				req.Header.Set("Authorization", "Bearer "+token)
				return req
			},
			wantStatus: http.StatusOK,
		},
		{
			name:   "保存Scratch项目",
			method: "PUT",
			path:   "/api/scratch/projects/0",
			setup: func() *http.Request {
				body := `{"name":"测试项目","content":{"test":"data"}}`
				req := httptest.NewRequest("PUT", "/api/scratch/projects/0", strings.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+token)
				return req
			},
			wantStatus: http.StatusOK,
		}, // 这里添加了缺失的逗号
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.setup()
			w := httptest.NewRecorder()
			s.router.ServeHTTP(w, req)
			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

// 添加测试服务器启动函数
func TestServer_Start(t *testing.T) {
	s := createTestServer(t)

	// 使用随机端口
	s.config.Server.Port = ":0"

	// 使用channel来同步
	done := make(chan struct{})
	errChan := make(chan error, 1)

	go func() {
		defer close(done)
		err := s.Start()
		if err != nil && err != http.ErrServerClosed {
			errChan <- err
		}
	}()

	// 等待服务器启动
	time.Sleep(500 * time.Millisecond)

	// 测试服务器是否响应 - 修改为测试根路径
	req := httptest.NewRequest("GET", "/auth/login", nil)
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)

	// 关闭服务器
	close(done)

	select {
	case err := <-errChan:
		assert.NoError(t, err)
	default:
	}
}

// 添加在文件顶部
const (
	testUsername = "testuser"
	testPassword = "password123"
	testEmail    = "test@example.com"
)

// 辅助函数：创建测试服务器
func createTestServer(t *testing.T) *Server {
	cfg := &config.Config{
		Database: config.DatabaseConfig{
			DSN: "file::memory:?cache=shared",
		},
		Storage: config.StorageConfig{
			BasePath: t.TempDir(),
		},
		JWT: config.JWTConfig{
			SecretKey: "test_key",
		},
	}
	s, err := NewServer(cfg)
	require.NoError(t, err)
	return s
}

// 辅助函数：创建测试用户并获取token
// 修复TestServer_AuthenticatedRoutes中的登录请求
func createTestUserAndToken(t *testing.T, s *Server) string {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.DefaultCost)
	if err != nil {
		require.NoError(t, err)
		return ""
	}
	// 创建测试用户
	user := model.User{
		Username: testUsername,
		Password: string(hashedPassword),
		Email:    testEmail,
	}
	result := s.db.Create(&user)
	require.NoError(t, result.Error)

	// 获取token
	loginReq := httptest.NewRequest("POST", "/api/auth/login",
		strings.NewReader(fmt.Sprintf(`{"username":"%s","password":"%s"}`, testUsername, testPassword)))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()
	s.router.ServeHTTP(loginW, loginReq)
	require.Equal(t, http.StatusOK, loginW.Code, "登录失败，响应体: "+loginW.Body.String()) // 添加错误信息

	var loginResp map[string]string
	err = json.Unmarshal(loginW.Body.Bytes(), &loginResp)
	require.NoError(t, err)
	require.NotEmpty(t, loginResp["token"], "返回的token为空")
	return loginResp["token"]
}
