package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/dao"
	"github.com/jun/fun_code/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockUserDao 是 UserDao 的模拟实现
type MockUserDao struct {
	mock.Mock
}

func (m *MockUserDao) CreateUser(user *model.User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *MockUserDao) GetUserByID(id uint) (*model.User, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserDao) GetUserByUsername(username string) (*model.User, error) {
	args := m.Called(username)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserDao) GetUserByEmail(email string) (*model.User, error) {
	args := m.Called(email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserDao) ListUsers(page, pageSize int) ([]model.User, int64, error) {
	args := m.Called(page, pageSize)
	return args.Get(0).([]model.User), args.Get(1).(int64), args.Error(2)
}

func (m *MockUserDao) UpdateUser(id uint, updates map[string]interface{}) error {
	args := m.Called(id, updates)
	return args.Error(0)
}

func (m *MockUserDao) UpdateUserProfile(id uint, nickname, email string) error {
	args := m.Called(id, nickname, email)
	return args.Error(0)
}

func (m *MockUserDao) ChangePassword(id uint, oldPassword, newPassword string) error {
	args := m.Called(id, oldPassword, newPassword)
	return args.Error(0)
}

func (m *MockUserDao) DeleteUser(id uint) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockUserDao) HardDeleteUser(id uint) error {
	args := m.Called(id)
	return args.Error(0)
}

// MockI18nService 是 I18nService 的模拟实现
type MockI18nService struct {
	mock.Mock
}

func (m *MockI18nService) Translate(messageID string, lang string) string {
	args := m.Called(messageID, lang)
	return args.String(0)
}

func (m *MockI18nService) TranslateWithData(messageID string, lang string, templateData map[string]interface{}) string {
	args := m.Called(messageID, lang, templateData)
	return args.String(0)
}

func (m *MockI18nService) GetDefaultLanguage() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockI18nService) GetSupportedLanguages() []string {
	args := m.Called()
	return args.Get(0).([]string)
}

// 设置测试环境
func setupUserTestHandler() (*gin.Engine, *MockUserDao, *MockI18nService) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	mockUserDao := new(MockUserDao)
	mockI18n := new(MockI18nService)

	// 创建一个简化版的 Handler
	h := &Handler{
		dao: dao.Dao{
			UserDao: mockUserDao,
		},
		i18n: mockI18n,
	}

	// 设置路由
	r.POST("/api/users", h.PostCreateUser)

	return r, mockUserDao, mockI18n
}

func TestPostCreateUser(t *testing.T) {
	_, mockUserDao, mockI18n := setupUserTestHandler()

	// 设置 I18n 服务的默认行为 - 修改为每个测试用例单独设置
	// mockI18n.On("GetDefaultLanguage").Return("en")
	// mockI18n.On("Translate", "common.invalid_request", "en").Return("Invalid request data")
	// mockI18n.On("Translate", "user.create_success", "en").Return("User created successfully")
	// mockI18n.On("Translate", "user.create_failed", "en").Return("Failed to create user")
	// mockI18n.On("Translate", "user.username_taken", "en").Return("Username is already taken")

	tests := []struct {
		name       string
		reqBody    map[string]interface{}
		mockErr    error
		wantStatus int
		wantResp   map[string]interface{}
	}{
		// 测试用例保持不变
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 重置 mock 对象
			mockUserDao = new(MockUserDao)
			mockI18n = new(MockI18nService)

			// 重新设置 Handler
			h := &Handler{
				dao: dao.Dao{
					UserDao: mockUserDao,
				},
				i18n: mockI18n,
			}
			r := gin.New()
			r.POST("/api/users", h.PostCreateUser)

			// 为每个测试用例单独设置 mock 行为
			mockI18n.On("GetDefaultLanguage").Return("en")

			if tt.name == "请求参数缺失" {
				mockI18n.On("Translate", "common.invalid_request", "en").Return("Invalid request data")
			} else if tt.name == "用户名已存在" {
				mockI18n.On("GetDefaultLanguage").Return("en")
				mockI18n.On("Translate", "user.username_taken", "en").Return("Username is already taken")
				mockUserDao.On("CreateUser", mock.AnythingOfType("*model.User")).Return(tt.mockErr)
			} else if tt.name == "数据库错误" {
				mockI18n.On("GetDefaultLanguage").Return("en")
				mockI18n.On("Translate", "user.create_failed", "en").Return("Failed to create user")
				mockUserDao.On("CreateUser", mock.AnythingOfType("*model.User")).Return(tt.mockErr)
			} else if tt.name == "正常创建用户" {
				mockI18n.On("Translate", "user.create_success", "en").Return("User created successfully")
				mockUserDao.On("CreateUser", mock.AnythingOfType("*model.User")).Return(nil)
			}

			// 创建请求
			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("POST", "/api/users", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Accept-Language", "en")
			w := httptest.NewRecorder()

			// 执行请求
			r.ServeHTTP(w, req)

			// 验证状态码
			assert.Equal(t, tt.wantStatus, w.Code)

			// 解析响应
			var resp map[string]interface{}
			json.Unmarshal(w.Body.Bytes(), &resp)

			// 验证响应内容
			if tt.wantStatus == http.StatusCreated {
				assert.Equal(t, tt.wantResp["message"], resp["message"])
				assert.NotNil(t, resp["data"])
				data := resp["data"].(map[string]interface{})
				assert.Equal(t, tt.reqBody["username"], data["username"])
				assert.Equal(t, tt.reqBody["email"], data["email"])
				assert.Equal(t, tt.reqBody["role"], data["role"])
			} else if tt.name == "用户名已存在" {
				assert.Equal(t, tt.wantResp["error"], resp["error"])
				assert.Equal(t, tt.wantResp["code"], resp["code"])
			} else if tt.name == "请求参数缺失" {
				assert.Equal(t, tt.wantResp["error"], resp["error"])
				assert.Contains(t, resp, "details")
			} else {
				assert.Equal(t, tt.wantResp["error"], resp["error"])
				assert.Contains(t, resp, "details")
			}

			// 验证 mock 调用
			mockUserDao.AssertExpectations(t)
			mockI18n.AssertExpectations(t)
		})
	}
}

// 测试不同语言的响应
func TestPostCreateUserI18n(t *testing.T) {
	// 不再使用全局设置的 mock 对象
	// r, mockUserDao, mockI18n := setupUserTestHandler()

	// 移除全局的 mock 期望设置
	// mockI18n.On("GetDefaultLanguage").Return("en")
	// mockI18n.On("Translate", "user.create_success", "zh-CN").Return("用户创建成功")
	// mockI18n.On("Translate", "common.invalid_request", "zh-CN").Return("无效的请求数据")

	tests := []struct {
		name       string
		lang       string
		reqBody    map[string]interface{}
		mockErr    error
		wantStatus int
		wantMsg    string
	}{
		{
			name: "中文成功响应",
			lang: "zh-CN",
			reqBody: map[string]interface{}{
				"username": "testuser",
				"password": "password123",
				"email":    "test@example.com",
			},
			mockErr:    nil,
			wantStatus: http.StatusCreated,
			wantMsg:    "用户创建成功",
		},
		{
			name: "中文错误响应",
			lang: "zh-CN",
			reqBody: map[string]interface{}{
				"username": "testuser",
				// 缺少必填字段
			},
			mockErr:    nil,
			wantStatus: http.StatusBadRequest,
			wantMsg:    "无效的请求数据",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 为每个测试用例创建新的 mock 对象
			mockUserDao := new(MockUserDao)
			mockI18n := new(MockI18nService)

			// 重新设置 Handler
			h := &Handler{
				dao: dao.Dao{
					UserDao: mockUserDao,
				},
				i18n: mockI18n,
			}
			r := gin.New()
			r.POST("/api/users", h.PostCreateUser)

			// 允许多次调用
			mockI18n.On("GetDefaultLanguage").Return("en")

			if tt.wantStatus == http.StatusCreated {
				mockI18n.On("Translate", "user.create_success", tt.lang).Return("用户创建成功")
				mockUserDao.On("CreateUser", mock.AnythingOfType("*model.User")).Return(nil)
			} else {
				mockI18n.On("Translate", "common.invalid_request", tt.lang).Return("无效的请求数据")
			}

			// 创建请求
			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("POST", "/api/users", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Accept-Language", tt.lang)
			w := httptest.NewRecorder()

			// 执行请求
			r.ServeHTTP(w, req)

			// 验证状态码
			assert.Equal(t, tt.wantStatus, w.Code)

			// 解析响应
			var resp map[string]interface{}
			json.Unmarshal(w.Body.Bytes(), &resp)

			// 验证响应消息
			if tt.wantStatus == http.StatusCreated {
				assert.Equal(t, tt.wantMsg, resp["message"])
			} else {
				assert.Equal(t, tt.wantMsg, resp["error"])
			}

			// 验证 mock 调用
			mockUserDao.AssertExpectations(t)
			mockI18n.AssertExpectations(t)
		})
	}
}
