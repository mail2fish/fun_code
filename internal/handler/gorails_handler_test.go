package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/dao"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockI18n 是 I18nService 的模拟实现 (重命名避免冲突)
type MockI18n struct {
	mock.Mock
}

func (m *MockI18n) Translate(messageID string, lang string) string {
	args := m.Called(messageID, lang)
	return args.String(0)
}

func (m *MockI18n) TranslateWithData(messageID string, lang string, templateData map[string]interface{}) string {
	args := m.Called(messageID, lang, templateData)
	return args.String(0)
}

func (m *MockI18n) GetDefaultLanguage() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockI18n) GetSupportedLanguages() []string {
	args := m.Called()
	return args.Get(0).([]string)
}

// TestRegisterHandler 测试注册handler的gorails.Wrap形式
func TestRegisterHandler(t *testing.T) {
	_, mockDao := setupTestHandler()

	tests := []struct {
		name       string
		reqBody    map[string]interface{}
		mockErr    error
		wantStatus int
		wantError  bool
	}{
		{
			name: "正常注册",
			reqBody: map[string]interface{}{
				"username": "testuser",
				"password": "password123",
				"email":    "test@example.com",
			},
			mockErr:    nil,
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name: "参数无效-缺少username",
			reqBody: map[string]interface{}{
				"password": "password123",
				"email":    "test@example.com",
			},
			mockErr:    nil,
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name: "参数无效-邮箱格式错误",
			reqBody: map[string]interface{}{
				"username": "testuser",
				"password": "password123",
				"email":    "invalid-email",
			},
			mockErr:    nil,
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 准备请求
			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")

			// 设置mock期望
			if username, ok := tt.reqBody["username"].(string); ok {
				password, _ := tt.reqBody["password"].(string)
				email, _ := tt.reqBody["email"].(string)
				mockDao.AuthDao.On("Register", username, password, email).Return(tt.mockErr).Maybe()
			}

			// 测试handler
			params := &RegisterParams{}
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = req

			// 解析参数
			if parseErr := params.Parse(ctx); parseErr != nil {
				assert.True(t, tt.wantError)
				return
			}

			// 创建handler实例
			handler := &Handler{dao: &dao.Dao{AuthDao: mockDao.AuthDao}}
			response, meta, err := handler.RegisterHandler(ctx, params)

			if tt.wantError {
				assert.NotNil(t, err)
			} else {
				assert.Nil(t, err)
				assert.NotNil(t, response)
				assert.Equal(t, "注册成功", response.Message)
				assert.Nil(t, meta)
			}

			mockDao.AuthDao.AssertExpectations(t)
		})
	}
}

// TestLoginHandler 测试登录handler的gorails.Wrap形式
func TestLoginHandler(t *testing.T) {
	tests := []struct {
		name       string
		reqBody    map[string]interface{}
		mockToken  string
		mockCookie *http.Cookie
		mockErr    error
		wantStatus int
		wantError  bool
	}{
		{
			name: "正常登录",
			reqBody: map[string]interface{}{
				"username": "testuser",
				"password": "password123",
			},
			mockToken: "valid.token.string",
			mockCookie: &http.Cookie{
				Name:     "auth_token",
				Value:    "valid.token.string",
				Path:     "/",
				HttpOnly: true,
				Secure:   true,
				MaxAge:   86400,
			},
			mockErr:    nil,
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name: "参数无效-缺少密码",
			reqBody: map[string]interface{}{
				"username": "testuser",
			},
			mockToken:  "",
			mockCookie: nil,
			mockErr:    nil,
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, mockDao := setupTestHandler()

			// 准备请求
			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")

			// 设置mock期望
			if username, ok := tt.reqBody["username"].(string); ok {
				password, _ := tt.reqBody["password"].(string)
				mockDao.AuthDao.On("Login", username, password).Return(tt.mockToken, tt.mockCookie, tt.mockErr).Maybe()
			}

			// 测试handler
			params := &LoginParams{}
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = req

			// 解析参数
			if parseErr := params.Parse(ctx); parseErr != nil {
				assert.True(t, tt.wantError)
				return
			}

			// 创建handler实例
			handler := &Handler{dao: &dao.Dao{AuthDao: mockDao.AuthDao}}
			response, meta, err := handler.LoginHandler(ctx, params)

			if tt.wantError {
				assert.NotNil(t, err)
			} else {
				assert.Nil(t, err)
				assert.NotNil(t, response)
				assert.Equal(t, tt.mockToken, response.Token)
				assert.Nil(t, meta)
			}

			mockDao.AuthDao.AssertExpectations(t)
		})
	}
}

// TestDeleteUserHandler 测试删除用户handler的gorails.Wrap形式
func TestDeleteUserHandler(t *testing.T) {
	tests := []struct {
		name           string
		userID         uint
		protectedUsers []uint
		mockUser       *model.User
		mockErr        error
		wantError      bool
		errorCode      int
	}{
		{
			name:           "正常删除用户",
			userID:         1,
			protectedUsers: []uint{},
			mockUser:       &model.User{ID: 1, Username: "testuser"},
			mockErr:        nil,
			wantError:      false,
		},
		{
			name:           "保护用户不能删除",
			userID:         1,
			protectedUsers: []uint{1},
			mockUser:       nil,
			mockErr:        nil,
			wantError:      true,
			errorCode:      40010,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, mockDao := setupTestHandler()

			// 设置mock期望
			if !tt.wantError || tt.errorCode != 40010 {
				mockDao.UserDao.On("DeleteUser", tt.userID).Return(tt.mockErr).Maybe()
			}

			// 创建handler实例
			mockI18n := new(MockI18n)
			mockI18n.On("GetDefaultLanguage").Return("zh-CN")
			mockI18n.On("Translate", "user.delete_success", "zh-CN").Return("删除成功")

			handler := &Handler{
				dao: &dao.Dao{UserDao: mockDao.UserDao},
				config: &config.Config{
					Protected: config.Protected{
						Users: tt.protectedUsers,
					},
				},
				i18n: mockI18n,
			}

			// 测试handler
			params := &DeleteUserParams{UserID: tt.userID}
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

			// 创建一个有效的HTTP请求以避免nil pointer
			req := httptest.NewRequest("DELETE", "/api/admin/users/1", nil)
			req.Header.Set("Accept-Language", "zh-CN")
			ctx.Request = req

			response, meta, err := handler.DeleteUserHandler(ctx, params)

			if tt.wantError {
				assert.NotNil(t, err)
				if tt.errorCode != 0 {
					gorailsErr := err.(gorails.Error)
					assert.Contains(t, string(gorailsErr.ErrorCode()), strconv.Itoa(tt.errorCode))
				}
			} else {
				assert.Nil(t, err)
				assert.NotNil(t, response)
				assert.Contains(t, response.Message, "删除成功")
				assert.Nil(t, meta)
			}

			mockDao.UserDao.AssertExpectations(t)
		})
	}
}

// TestGetScratchProjectHandler 测试获取Scratch项目handler的gorails.Wrap形式
func TestGetScratchProjectHandler(t *testing.T) {
	tests := []struct {
		name           string
		projectID      string
		mockUserID     uint
		mockProjectUID uint
		mockData       []byte
		mockExists     bool
		mockErr        error
		wantError      bool
		errorCode      int
	}{
		{
			name:           "正常获取项目",
			projectID:      "1",
			mockUserID:     1,
			mockProjectUID: 1,
			mockData:       []byte("project data"),
			mockExists:     true,
			mockErr:        nil,
			wantError:      false,
		},
		{
			name:           "无效的项目ID",
			projectID:      "invalid",
			mockUserID:     1,
			mockProjectUID: 0,
			mockData:       nil,
			mockExists:     false,
			mockErr:        nil,
			wantError:      true,
			errorCode:      40014,
		},
		{
			name:           "项目不存在",
			projectID:      "999",
			mockUserID:     1,
			mockProjectUID: 0,
			mockData:       nil,
			mockExists:     false,
			mockErr:        nil,
			wantError:      true,
			errorCode:      40015,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, mockDao := setupTestHandler()

			// 设置mock期望
			if tt.mockExists {
				mockDao.ScratchDao.On("GetProjectUserID", mock.AnythingOfType("uint")).Return(tt.mockProjectUID, tt.mockExists).Maybe()
				mockDao.ScratchDao.On("GetProjectBinary", mock.AnythingOfType("uint"), mock.AnythingOfType("string")).Return(tt.mockData, tt.mockErr).Maybe()
			} else if tt.projectID != "invalid" {
				mockDao.ScratchDao.On("GetProjectUserID", mock.AnythingOfType("uint")).Return(tt.mockProjectUID, tt.mockExists).Maybe()
			}

			// 创建handler实例
			handler := &Handler{dao: &dao.Dao{ScratchDao: mockDao.ScratchDao}}

			// 创建一个简单的上下文来模拟用户ID
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Set("userID", tt.mockUserID)

			// 测试handler
			params := &GetScratchProjectParams{ID: tt.projectID}

			response, meta, err := handler.GetScratchProjectHandler(ctx, params)

			if tt.wantError {
				assert.NotNil(t, err)
				if tt.errorCode != 0 {
					gorailsErr := err.(gorails.Error)
					assert.Contains(t, string(gorailsErr.ErrorCode()), strconv.Itoa(tt.errorCode))
				}
			} else {
				assert.Nil(t, err)
				assert.NotNil(t, response)
				assert.Equal(t, tt.mockData, response)
				assert.Nil(t, meta)
			}

			mockDao.ScratchDao.AssertExpectations(t)
		})
	}
}

// TestGetLibraryAssetHandler 测试获取库资源handler的gorails.Wrap形式
func TestGetLibraryAssetHandler(t *testing.T) {
	tests := []struct {
		name      string
		filename  string
		wantError bool
		errorCode int
	}{
		{
			name:      "空文件名",
			filename:  "",
			wantError: true,
			errorCode: 40019,
		},
		{
			name:      "无效资源ID长度",
			filename:  "short",
			wantError: true,
			errorCode: 40020,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, mockDao := setupTestHandler()

			// 创建handler实例
			handler := &Handler{dao: &dao.Dao{ScratchDao: mockDao.ScratchDao}}

			// 测试handler
			params := &GetLibraryAssetParams{Filename: tt.filename}
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

			response, meta, err := handler.GetLibraryAssetHandler(ctx, params)

			if tt.wantError {
				assert.NotNil(t, err)
				if tt.errorCode != 0 {
					gorailsErr := err.(gorails.Error)
					assert.Contains(t, string(gorailsErr.ErrorCode()), strconv.Itoa(tt.errorCode))
				}
				assert.Nil(t, response)
			} else {
				assert.Nil(t, err)
				assert.NotNil(t, response)
			}

			assert.Nil(t, meta)
		})
	}
}

// TestGetScratchProjectHistoriesHandler 测试获取项目历史handler的gorails.Wrap形式
func TestGetScratchProjectHistoriesHandler(t *testing.T) {
	tests := []struct {
		name        string
		projectID   string
		mockProject *model.ScratchProject
		mockErr     error
		wantError   bool
		errorCode   int
	}{
		{
			name:      "无效的项目ID",
			projectID: "invalid",
			wantError: true,
			errorCode: 40032,
		},
		{
			name:        "项目不存在",
			projectID:   "999",
			mockProject: nil,
			mockErr:     assert.AnError,
			wantError:   true,
			errorCode:   40033,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, mockDao := setupTestHandler()

			// 设置mock期望
			if tt.projectID != "invalid" {
				mockDao.ScratchDao.On("GetProject", mock.AnythingOfType("uint")).Return(tt.mockProject, tt.mockErr).Maybe()
			}

			// 创建handler实例
			handler := &Handler{dao: &dao.Dao{ScratchDao: mockDao.ScratchDao}}

			// 测试handler
			params := &GetScratchProjectHistoriesParams{ID: tt.projectID}
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

			response, meta, err := handler.GetScratchProjectHistoriesHandler(ctx, params)

			if tt.wantError {
				assert.NotNil(t, err)
				if tt.errorCode != 0 {
					gorailsErr := err.(gorails.Error)
					assert.Contains(t, string(gorailsErr.ErrorCode()), strconv.Itoa(tt.errorCode))
				}
			} else {
				assert.Nil(t, err)
				assert.NotNil(t, response)
				assert.Nil(t, meta)
			}

			mockDao.ScratchDao.AssertExpectations(t)
		})
	}
}
