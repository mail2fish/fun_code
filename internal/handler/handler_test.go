package handler

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/dao"
	"github.com/jun/fun_code/internal/i18n"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"go.uber.org/zap"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockAuthService 是 AuthService 的模拟实现
type MockAuthService struct {
	mock.Mock
}

func (m *MockAuthService) GenerateCookie(token string) *http.Cookie {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil
	}
	return args.Get(0).(*http.Cookie)
}

func (m *MockAuthService) Register(username, password, email string) error {
	args := m.Called(username, password, email)
	return args.Error(0)
}

// 修改 MockAuthService 的 Login 方法
func (m *MockAuthService) Login(username, password string) (string, *http.Cookie, error) {
	args := m.Called(username, password)
	if args.Get(1) == nil {
		return args.String(0), nil, args.Error(2)
	}
	return args.String(0), args.Get(1).(*http.Cookie), args.Error(2)
}

// Logout 方法的模拟实现
func (m *MockAuthService) Logout(token string) (*http.Cookie, error) {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*http.Cookie), args.Error(1)
}

// 修改 TestHandler_Login 测试函数
func TestHandler_Login(t *testing.T) {
	r, mockDao := setupTestHandler()

	tests := []struct {
		name       string
		reqBody    map[string]interface{}
		mockToken  string
		mockCookie *http.Cookie
		mockErr    error
		wantStatus int
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
				SameSite: http.SameSiteStrictMode,
				MaxAge:   86400,
			},
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
		{
			name: "参数无效",
			reqBody: map[string]interface{}{
				"username": "testuser",
			},
			mockToken:  "",
			mockCookie: nil,
			mockErr:    nil,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			if username, ok := tt.reqBody["username"].(string); ok {
				password, _ := tt.reqBody["password"].(string)
				mockDao.AuthDao.On("Login", username, password).Return(tt.mockToken, tt.mockCookie, tt.mockErr).Maybe()
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			if tt.wantStatus == http.StatusOK {
				// 验证响应中的 token
				var response map[string]string
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.mockToken, response["token"])

				// 验证 cookie
				if tt.mockCookie != nil {
					cookies := w.Result().Cookies()
					assert.GreaterOrEqual(t, len(cookies), 1)
					found := false
					for _, cookie := range cookies {
						if cookie.Name == tt.mockCookie.Name {
							assert.Equal(t, tt.mockCookie.Value, cookie.Value)
							assert.Equal(t, tt.mockCookie.Path, cookie.Path)
							assert.Equal(t, tt.mockCookie.HttpOnly, cookie.HttpOnly)
							assert.Equal(t, tt.mockCookie.Secure, cookie.Secure)
							assert.Equal(t, tt.mockCookie.MaxAge, cookie.MaxAge)
							found = true
							break
						}
					}
					assert.True(t, found, "未找到预期的 cookie")
				}
			}
			mockDao.AuthDao.AssertExpectations(t)
		})
	}
}

func (m *MockAuthService) ValidateToken(token string) (*dao.Claims, error) {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*dao.Claims), args.Error(1)
}

// MockFileService 是 FileService 的模拟实现
type MockFileService struct {
	mock.Mock
}

func (m *MockFileService) GetFileBySHA1(sha1 string) (*model.File, gorails.Error) {
	args := m.Called(sha1)
	if args.Get(0) == nil {
		return nil, args.Error(1).(gorails.Error)
	}
	return args.Get(0).(*model.File), args.Error(1).(gorails.Error)
}

func (m *MockFileService) CountFiles() (int64, gorails.Error) {
	args := m.Called()
	return args.Get(0).(int64), args.Error(1).(gorails.Error)
}

func (m *MockFileService) CreateFile(file *model.File) gorails.Error {
	args := m.Called(file)
	return args.Error(0).(gorails.Error)
}

func (m *MockFileService) GetFile(fileID uint) (*model.File, gorails.Error) {
	args := m.Called(fileID)
	if args.Get(0) == nil {
		return nil, args.Error(1).(gorails.Error)
	}
	return args.Get(0).(*model.File), args.Error(1).(gorails.Error)
}

func (m *MockFileService) ListFilesWithPagination(pageSize uint, beginID uint, forward, asc bool) ([]*model.File, bool, gorails.Error) {
	args := m.Called(pageSize, beginID, forward, asc)
	return args.Get(0).([]*model.File), args.Bool(1), args.Error(2).(gorails.Error)
}

func (m *MockFileService) DeleteFile(fileID uint) gorails.Error {
	args := m.Called(fileID)
	return args.Error(0).(gorails.Error)
}

func (m *MockFileService) UpdateFile(fileID uint, updates map[string]interface{}) gorails.Error {
	args := m.Called(fileID, updates)
	return args.Error(0).(gorails.Error)
}

// MockScratchDao 是 ScratchService 的模拟实现
type MockScratchDao struct {
	mock.Mock
}

func (m *MockScratchDao) SearchProjects(userID uint, keyword string) ([]model.ScratchProject, error) {
	args := m.Called(userID, keyword)
	return args.Get(0).([]model.ScratchProject), args.Error(1)
}

func (m *MockScratchDao) GetProjectBinary(projectID uint, md5 string) ([]byte, error) {
	args := m.Called(projectID, md5)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]byte), args.Error(1)
}

func (m *MockScratchDao) SaveProject(userID uint, projectID uint, name string, content []byte) (uint, error) {
	args := m.Called(userID, projectID, name, content)
	return args.Get(0).(uint), args.Error(1)
}

func (m *MockScratchDao) CountProjects(userID uint) (int64, error) {
	args := m.Called(userID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockScratchDao) DeleteProject(userID uint, projectID uint) error {
	args := m.Called(userID, projectID)
	return args.Error(0)
}

func (m *MockScratchDao) GetProjectUserID(projectID uint) (uint, bool) {
	args := m.Called(projectID)
	return args.Get(0).(uint), args.Bool(1)
}

func (m *MockScratchDao) GetProjectInfo(projectID uint) (*model.ScratchProject, error) {
	args := m.Called(projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.ScratchProject), args.Error(1)
}

func (m *MockScratchDao) GetProject(projectID uint) (*model.ScratchProject, error) {
	args := m.Called(projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.ScratchProject), args.Error(1)
}

func (m *MockScratchDao) GetScratchBasePath() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockScratchDao) SaveAsset(userID uint, projectID uint, filename string, file *multipart.FileHeader) (string, error) {
	args := m.Called(userID, projectID, filename, file)
	return args.String(0), args.Error(1)
}

// 在 MockScratchService 中添加 ListProjectsWithPagination 方法
func (m *MockScratchDao) ListProjectsWithPagination(userID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.ScratchProject, bool, error) {
	args := m.Called(userID, pageSize, beginID, forward, asc)
	return args.Get(0).([]model.ScratchProject), args.Bool(1), args.Error(2)
}

func (m *MockScratchDao) CreateProject(userID uint) (uint, error) {
	args := m.Called(userID)
	return args.Get(0).(uint), args.Error(1)
}

// MockUserDao 是 UserDao 的模拟实现
type MockUserDao struct {
	mock.Mock
}

func (m *MockUserDao) SearchUsers(keyword string) ([]model.User, error) {
	args := m.Called(keyword)
	return args.Get(0).([]model.User), args.Error(1)
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

func (m *MockUserDao) CreateUser(user *model.User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *MockUserDao) ListUsers(pageSize uint, beginID uint, forward, asc bool) ([]model.User, bool, error) {
	args := m.Called(pageSize, beginID, forward, asc)
	return args.Get(0).([]model.User), args.Bool(1), args.Error(2)
}

func (m *MockUserDao) ChangePassword(userID uint, newPassword, oldPassword string) error {
	args := m.Called(userID, newPassword, oldPassword)
	return args.Error(0)
}

func (m *MockUserDao) CountUsers() (int64, error) {
	args := m.Called()
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockUserDao) DeleteUser(userID uint) error {
	args := m.Called(userID)
	return args.Error(0)
}

func (m *MockUserDao) GetUserByEmail(email string) (*model.User, error) {
	args := m.Called(email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserDao) UpdateUser(userID uint, data map[string]interface{}) error {
	args := m.Called(userID, data)
	return args.Error(0)
}

func (m *MockUserDao) HardDeleteUser(userID uint) error {
	args := m.Called(userID)
	return args.Error(0)
}

func (m *MockUserDao) UpdateUserProfile(userID uint, nickname string, email string) error {
	args := m.Called(userID, nickname, email)
	return args.Error(0)
}

func (m *MockUserDao) GetUsersByIDs(ids []uint) ([]model.User, error) {
	args := m.Called(ids)
	return args.Get(0).([]model.User), args.Error(1)
}

type MockUserAssetDao struct {
	mock.Mock
}

func (m *MockUserAssetDao) CreateUserAsset(userAsset *model.UserAsset) error {
	args := m.Called(userAsset)
	return args.Error(0)
}

func (m *MockUserAssetDao) GetUserAsset(userID uint, assetID string) (*model.UserAsset, error) {
	args := m.Called(userID, assetID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.UserAsset), args.Error(1)
}

func (m *MockUserAssetDao) DeleteUserAsset(id uint) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockUserAssetDao) ListUserAssetsWithPagination(userID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.UserAsset, bool, error) {
	args := m.Called(userID, pageSize, beginID, forward, asc)
	return args.Get(0).([]model.UserAsset), args.Bool(1), args.Error(2)
}

type MockDao struct {
	AuthDao      *MockAuthService
	FileDao      *MockFileService
	UserDao      *MockUserDao
	ScratchDao   *MockScratchDao
	UserAssetDao *MockUserAssetDao
}

// 修改 setupTestHandler 函数，添加 MockFileService 并调整返回顺序
func setupTestHandler() (*gin.Engine, *MockDao) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	mockAuth := new(MockAuthService)
	mockFile := new(MockFileService)
	mockUserDao := new(MockUserDao)
	mockScratch := new(MockScratchDao)
	mockUserAsset := new(MockUserAssetDao)

	i18n, err := i18n.NewI18nService("en")
	if err != nil {
		panic(err)
	}
	cfg := &config.Config{
		ScratchEditor: config.ScratchEditorConfig{
			Host:                 "http://localhost",
			CreateProjectLimiter: 20,
		},
	}
	mockDao := &dao.Dao{
		AuthDao:      mockAuth,
		FileDao:      mockFile, // 正确赋值 FileDao
		UserDao:      mockUserDao,
		ScratchDao:   mockScratch,
		UserAssetDao: mockUserAsset,
	}
	h := NewHandler(mockDao, i18n, zap.NewNop(), cfg)

	// 设置路由
	r.POST("/api/auth/register", h.Register)
	r.POST("/api/auth/login", h.Login)
	r.POST("/api/auth/logout", h.Logout)

	auth := r.Group("/api")
	auth.Use(h.AuthMiddleware())
	{

		// Scratch 相关路由
		auth.GET("/scratch/projects/:id", h.GetScratchProject)
		auth.POST("/scratch/projects", h.PostCreateScratchProject)
		auth.PUT("/scratch/projects/:id", h.PutSaveScratchProject)
		auth.GET("/scratch/projects", h.ListScratchProjects)
		// auth.DELETE("/scratch/projects/:id", h.DeleteScratchProject) // 已改为 gorails.Wrap 形式

	}

	assets := r.Group("/assets")
	assets.Use(h.AuthMiddleware())
	// 添加新的路由用于获取Scratch资源文件
	{
		assets.GET("/scratch/:filename", h.GetLibraryAsset)
		assets.POST("/scratch/:asset_id", h.UploadScratchAsset)
	}

	d := &MockDao{
		AuthDao:      mockAuth,
		FileDao:      mockFile,
		UserDao:      mockUserDao,
		ScratchDao:   mockScratch,
		UserAssetDao: mockUserAsset,
	}

	return r, d
}

// 修改现有测试函数，添加 mockScratch 参数
func TestHandler_Register(t *testing.T) {
	r, mockDao := setupTestHandler() // 使用下划线忽略不需要的返回值

	tests := []struct {
		name       string
		reqBody    map[string]interface{}
		mockReturn error
		wantStatus int
	}{
		{
			name: "正常注册",
			reqBody: map[string]interface{}{
				"username": "testuser",
				"password": "password123",
				"email":    "test@example.com",
			},
			mockReturn: nil,
			wantStatus: http.StatusOK,
		},
		{
			name: "参数无效",
			reqBody: map[string]interface{}{
				"username": "testuser",
			},
			mockReturn: nil,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			if username, ok := tt.reqBody["username"].(string); ok {
				password, _ := tt.reqBody["password"].(string)
				email, _ := tt.reqBody["email"].(string)
				mockDao.AuthDao.On("Register", username, password, email).Return(tt.mockReturn).Maybe()
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockDao.AuthDao.AssertExpectations(t)
		})
	}
}

func TestHandler_AuthMiddleware(t *testing.T) {
	r, mocdDao := setupTestHandler()

	tests := []struct {
		name       string
		token      string
		mockClaims *dao.Claims
		mockErr    error
		wantStatus int
	}{
		{
			name:  "有效token",
			token: "valid.token.string",
			mockClaims: &dao.Claims{
				UserID: 1,
			},
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mocdDao.AuthDao.On("ValidateToken", tt.token).Return(tt.mockClaims, tt.mockErr)
			mocdDao.FileDao.On("ListFiles", tt.mockClaims.UserID, (*uint)(nil)).Return([]model.File{}, nil)

			req := httptest.NewRequest("GET", "/api/files", nil)
			req.Header.Set("Authorization", tt.token)
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mocdDao.AuthDao.AssertExpectations(t)
			mocdDao.FileDao.AssertExpectations(t)
		})
	}
}

func TestHandler_CreateDirectory(t *testing.T) {
	r, mockDao := setupTestHandler()

	tests := []struct {
		name       string
		reqBody    map[string]interface{}
		mockErr    error
		wantStatus int
	}{
		{
			name: "正常创建目录",
			reqBody: map[string]interface{}{
				"name": "test_dir",
			},
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockDao.AuthDao.On("ValidateToken", "valid.token.string").Return(&dao.Claims{UserID: 1}, nil)
			mockDao.FileDao.On("CreateDirectory", uint(1), tt.reqBody["name"].(string), (*uint)(nil)).Return(tt.mockErr)

			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("POST", "/api/directories", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockDao.AuthDao.AssertExpectations(t)
			mockDao.FileDao.AssertExpectations(t)
		})
	}
}

func TestHandler_UploadFile(t *testing.T) {
	r, mockDao := setupTestHandler()

	tests := []struct {
		name       string
		fileName   string
		mockErr    error
		wantStatus int
	}{
		{
			name:       "正常上传文件",
			fileName:   "test.txt",
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content := []byte("test content")
			body := &bytes.Buffer{}
			writer := multipart.NewWriter(body)
			part, _ := writer.CreateFormFile("file", tt.fileName)
			part.Write(content)
			writer.Close()

			mockDao.AuthDao.On("ValidateToken", "valid.token.string").Return(&dao.Claims{UserID: 1}, nil)
			mockDao.FileDao.On("UploadFile", uint(1), tt.fileName, (*uint)(nil), "application/octet-stream", int64(len(content)), mock.Anything).Return(tt.mockErr)

			req := httptest.NewRequest("POST", "/api/files", body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockDao.AuthDao.AssertExpectations(t)
			mockDao.FileDao.AssertExpectations(t)
		})
	}
}

func (m *MockAuthService) GetUserByID(id uint) (*model.User, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockAuthService) HasPermission(permission string) bool {
	args := m.Called(permission)
	return args.Bool(0)
}
