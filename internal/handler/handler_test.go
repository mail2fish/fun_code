package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/jun/fun_code/internal/model"
	"github.com/jun/fun_code/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"
)

// MockAuthService 是 AuthService 的模拟实现
type MockAuthService struct {
	mock.Mock
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

// 修改 TestHandler_Login 测试函数
func TestHandler_Login(t *testing.T) {
	r, mockAuth, _, _ := setupTestHandler()

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
				mockAuth.On("Login", username, password).Return(tt.mockToken, tt.mockCookie, tt.mockErr).Maybe()
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
			mockAuth.AssertExpectations(t)
		})
	}
}

func (m *MockAuthService) ValidateToken(token string) (*service.Claims, error) {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.Claims), args.Error(1)
}

// MockFileService 是 FileService 的模拟实现
type MockFileService struct {
	mock.Mock
}

func (m *MockFileService) CreateDirectory(userID uint, name string, parentID *uint) error {
	args := m.Called(userID, name, parentID)
	return args.Error(0)
}

func (m *MockFileService) UploadFile(userID uint, name string, parentID *uint, contentType string, size int64, reader io.Reader) error {
	args := m.Called(userID, name, parentID, contentType, size, reader)
	return args.Error(0)
}

func (m *MockFileService) GetFile(userID, fileID uint) (*model.File, error) {
	args := m.Called(userID, fileID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.File), args.Error(1)
}

func (m *MockFileService) ListFiles(userID uint, parentID *uint) ([]model.File, error) {
	args := m.Called(userID, parentID)
	return args.Get(0).([]model.File), args.Error(1)
}

func (m *MockFileService) DeleteFile(userID, fileID uint) error {
	args := m.Called(userID, fileID)
	return args.Error(0)
}

// 添加 ValidateCookie 方法到 MockAuthService
func (m *MockAuthService) ValidateCookie(cookie *http.Cookie) (*service.Claims, error) {
	args := m.Called(cookie)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.Claims), args.Error(1)
}

// 修复 GenerateCookie 方法的位置和 setupTestHandler 函数
func (m *MockAuthService) GenerateCookie(token string) *http.Cookie {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil
	}
	return args.Get(0).(*http.Cookie)
}

// MockScratchService 是 ScratchService 的模拟实现
type MockScratchService struct {
	mock.Mock
}

func (m *MockScratchService) GetProject(projectID uint) ([]byte, error) {
	args := m.Called(projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]byte), args.Error(1)
}

func (m *MockScratchService) SaveProject(userID uint, projectID uint, name string, content []byte) (uint, error) {
	args := m.Called(userID, projectID, name, content)
	return args.Get(0).(uint), args.Error(1)
}

func (m *MockScratchService) ListProjects(userID uint) ([]model.ScratchProject, error) {
	args := m.Called(userID)
	return args.Get(0).([]model.ScratchProject), args.Error(1)
}

func (m *MockScratchService) DeleteProject(userID uint, projectID uint) error {
	args := m.Called(userID, projectID)
	return args.Error(0)
}

// 修改 setupTestHandler 函数，添加 MockScratchService
func setupTestHandler() (*gin.Engine, *MockAuthService, *MockFileService, *MockScratchService) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	mockAuth := new(MockAuthService)
	mockFile := new(MockFileService)
	mockScratch := new(MockScratchService)
	h := NewHandler(mockAuth, mockFile, mockScratch)

	// 设置路由
	r.POST("/api/auth/register", h.Register)
	r.POST("/api/auth/login", h.Login)

	auth := r.Group("/api")
	auth.Use(h.AuthMiddleware())
	{
		auth.POST("/directories", h.CreateDirectory)
		auth.POST("/files", h.UploadFile)
		auth.GET("/files", h.ListFiles)
		auth.GET("/files/:id", h.DownloadFile)
		auth.DELETE("/files/:id", h.DeleteFile)

		// Scratch 相关路由
		auth.GET("/scratch/projects/:id", h.GetScratchProject)
		auth.POST("/scratch/projects", h.SaveScratchProject)
		auth.GET("/scratch/projects", h.ListScratchProjects)
		auth.DELETE("/scratch/projects/:id", h.DeleteScratchProject)
	}

	return r, mockAuth, mockFile, mockScratch
}

// 修改现有测试函数，添加 mockScratch 参数
func TestHandler_Register(t *testing.T) {
	r, mockAuth, _, _ := setupTestHandler()
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
				mockAuth.On("Register", username, password, email).Return(tt.mockReturn).Maybe()
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockAuth.AssertExpectations(t)
		})
	}
}

func TestHandler_AuthMiddleware(t *testing.T) {
	r, mockAuth, mockFile, _ := setupTestHandler()

	tests := []struct {
		name       string
		token      string
		mockClaims *service.Claims
		mockErr    error
		wantStatus int
	}{
		{
			name:  "有效token",
			token: "valid.token.string",
			mockClaims: &service.Claims{
				UserID: 1,
			},
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAuth.On("ValidateToken", tt.token).Return(tt.mockClaims, tt.mockErr)
			mockFile.On("ListFiles", tt.mockClaims.UserID, (*uint)(nil)).Return([]model.File{}, nil)

			req := httptest.NewRequest("GET", "/api/files", nil)
			req.Header.Set("Authorization", tt.token)
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockAuth.AssertExpectations(t)
			mockFile.AssertExpectations(t)
		})
	}
}

func TestHandler_CreateDirectory(t *testing.T) {
	r, mockAuth, mockFile, _ := setupTestHandler()

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
			mockAuth.On("ValidateToken", "valid.token.string").Return(&service.Claims{UserID: 1}, nil)
			mockFile.On("CreateDirectory", uint(1), tt.reqBody["name"].(string), (*uint)(nil)).Return(tt.mockErr)

			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("POST", "/api/directories", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockAuth.AssertExpectations(t)
			mockFile.AssertExpectations(t)
		})
	}
}

func TestHandler_UploadFile(t *testing.T) {
	r, mockAuth, mockFile, _ := setupTestHandler()

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

			mockAuth.On("ValidateToken", "valid.token.string").Return(&service.Claims{UserID: 1}, nil)
			mockFile.On("UploadFile", uint(1), tt.fileName, (*uint)(nil), "application/octet-stream", int64(len(content)), mock.Anything).Return(tt.mockErr)

			req := httptest.NewRequest("POST", "/api/files", body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockAuth.AssertExpectations(t)
			mockFile.AssertExpectations(t)
		})
	}
}

func TestHandler_ListFiles(t *testing.T) {
	r, mockAuth, mockFile, _ := setupTestHandler()

	tests := []struct {
		name       string
		files      []model.File
		mockErr    error
		wantStatus int
	}{
		{
			name: "正常列出文件",
			files: []model.File{
				{
					Model:       gorm.Model{ID: 1},
					Name:        "test.txt",
					Path:        "/tmp/test.txt",
					ContentType: "text/plain",
					IsDirectory: false,
				},
			},
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAuth.On("ValidateToken", "valid.token.string").Return(&service.Claims{UserID: 1}, nil)
			mockFile.On("ListFiles", uint(1), (*uint)(nil)).Return(tt.files, tt.mockErr)

			req := httptest.NewRequest("GET", "/api/files", nil)
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			if tt.wantStatus == http.StatusOK {
				var response []model.File
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.files, response)
			}
			mockAuth.AssertExpectations(t)
			mockFile.AssertExpectations(t)
		})
	}
}

func TestHandler_DownloadFile(t *testing.T) {
	r, mockAuth, mockFile, _ := setupTestHandler()

	tests := []struct {
		name       string
		fileID     string
		mockFile   *model.File
		mockErr    error
		wantStatus int
	}{
		{
			name:       "成功下载文件",
			fileID:     "1",
			mockFile:   &model.File{Name: "test.txt", ContentType: "text/plain", Path: "testdata/test.txt", IsDirectory: false},
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
		{
			name:       "文件不存在",
			fileID:     "999",
			mockFile:   nil,
			mockErr:    gorm.ErrRecordNotFound,
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/files/"+tt.fileID, nil)
			req.Header.Set("Authorization", "valid.token.string")
			w := httptest.NewRecorder()

			// 设置认证中间件的mock
			mockAuth.On("ValidateToken", "valid.token.string").Return(&service.Claims{UserID: 1}, nil)

			// 设置GetFile的mock
			if tt.fileID != "invalid" {
				if tt.mockErr == nil {
					mockFile.On("GetFile", uint(1), uint(1)).Return(tt.mockFile, tt.mockErr)
				} else {
					mockFile.On("GetFile", uint(1), uint(999)).Return((*model.File)(nil), tt.mockErr)
				}
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			if tt.wantStatus == http.StatusOK {
				assert.Equal(t, tt.mockFile.ContentType, w.Header().Get("Content-Type"))
				assert.Contains(t, w.Header().Get("Content-Disposition"), tt.mockFile.Name)
				assert.FileExists(t, tt.mockFile.Path)
			} else {
				var resp map[string]interface{}
				json.Unmarshal(w.Body.Bytes(), &resp)
				assert.Equal(t, tt.wantStatus, w.Code)
				assert.Contains(t, resp["error"].(string), tt.mockErr.Error())
			}
			mockAuth.AssertExpectations(t)
			mockFile.AssertExpectations(t)
		})
	}
}

func TestHandler_DeleteFile(t *testing.T) {
	r, mockAuth, mockFile, _ := setupTestHandler()

	tests := []struct {
		name       string
		fileID     string
		mockErr    error
		wantStatus int
	}{
		{
			name:       "正常删除文件",
			fileID:     "1",
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
		{
			name:       "无效的文件ID",
			fileID:     "invalid",
			mockErr:    nil,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "删除文件失败",
			fileID:     "1",
			mockErr:    errors.New("删除失败"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("DELETE", "/api/files/"+tt.fileID, nil)
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			// 设置认证中间件的mock
			mockAuth.On("ValidateToken", "valid.token.string").Return(&service.Claims{UserID: 1}, nil)

			// 设置DeleteFile的mock
			if tt.fileID != "invalid" {
				mockFile.On("DeleteFile", uint(1), uint(1)).Return(tt.mockErr).Once()
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockAuth.AssertExpectations(t)
			mockFile.AssertExpectations(t)
		})
	}
}

// 添加 Scratch 相关测试函数
func TestHandler_GetScratchProject(t *testing.T) {
	r, mockAuth, _, mockScratch := setupTestHandler()

	tests := []struct {
		name       string
		projectID  string
		mockData   []byte
		mockErr    error
		wantStatus int
	}{
		{
			name:       "正常获取项目",
			projectID:  "1",
			mockData:   []byte(`{"test":"data"}`),
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
		{
			name:       "无效的项目ID",
			projectID:  "invalid",
			mockData:   nil,
			mockErr:    nil,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "项目不存在",
			projectID:  "999",
			mockData:   nil,
			mockErr:    errors.New("项目不存在"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/scratch/projects/"+tt.projectID, nil)
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			// 设置认证中间件的mock
			mockAuth.On("ValidateToken", "valid.token.string").Return(&service.Claims{UserID: 1}, nil)

			// 设置GetProject的mock
			if tt.projectID != "invalid" {
				id, _ := strconv.ParseUint(tt.projectID, 10, 64)
				mockScratch.On("GetProject", uint(id)).Return(tt.mockData, tt.mockErr).Once()
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			if tt.wantStatus == http.StatusOK {
				// 修改 TestHandler_GetScratchProject 函数中的断言部分
				assert.Equal(t, "application/octet-stream", w.Header().Get("Content-Type"))
				// 检查 Content-Length 是否正确
				assert.Equal(t, strconv.Itoa(len(tt.mockData)), w.Header().Get("Content-Length"))
				// 检查响应体是否与模拟数据一致
				assert.Equal(t, string(tt.mockData), w.Body.String())
			}
			mockAuth.AssertExpectations(t)
			mockScratch.AssertExpectations(t)
		})
	}
}

func TestHandler_SaveScratchProject(t *testing.T) {
	r, mockAuth, _, mockScratch := setupTestHandler()

	tests := []struct {
		name       string
		reqBody    map[string]interface{}
		mockID     uint
		mockErr    error
		wantStatus int
	}{
		{
			name: "正常保存项目",
			reqBody: map[string]interface{}{
				"name":    "测试项目",
				"content": map[string]interface{}{"test": "data"},
			},
			mockID:     1,
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
		{
			name: "参数无效",
			reqBody: map[string]interface{}{
				"name": "测试项目",
			},
			mockID:     0,
			mockErr:    nil,
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "保存失败",
			reqBody: map[string]interface{}{
				"name":    "测试项目",
				"content": map[string]interface{}{"test": "data"},
			},
			mockID:     0,
			mockErr:    errors.New("保存失败"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("POST", "/api/scratch/projects", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			// 设置认证中间件的mock
			mockAuth.On("ValidateToken", "valid.token.string").Return(&service.Claims{UserID: 1}, nil)

			// 设置SaveProject的mock
			if content, ok := tt.reqBody["content"]; ok {
				name := tt.reqBody["name"].(string)
				contentBytes, _ := json.Marshal(content)
				mockScratch.On("SaveProject", uint(1), uint(0), name, contentBytes).Return(tt.mockID, tt.mockErr).Once()
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockAuth.AssertExpectations(t)
			mockScratch.AssertExpectations(t)
		})
	}
}

func TestHandler_ListScratchProjects(t *testing.T) {
	r, mockAuth, _, mockScratch := setupTestHandler()

	tests := []struct {
		name       string
		projects   []model.ScratchProject
		mockErr    error
		wantStatus int
	}{
		{
			name: "正常列出项目",
			projects: []model.ScratchProject{
				{
					ID:       1,
					UserID:   1,
					Name:     "测试项目1",
					FilePath: "/tmp/test1.json",
				},
				{
					ID:       2,
					UserID:   1,
					Name:     "测试项目2",
					FilePath: "/tmp/test2.json",
				},
			},
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
		{
			name:       "列出项目失败",
			projects:   nil,
			mockErr:    errors.New("列出项目失败"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/scratch/projects", nil)
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			// 设置认证中间件的mock
			mockAuth.On("ValidateToken", "valid.token.string").Return(&service.Claims{UserID: 1}, nil)

			// 设置ListProjects的mock
			mockScratch.On("ListProjects", uint(1)).Return(tt.projects, tt.mockErr).Once()

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			if tt.wantStatus == http.StatusOK {
				var response []model.ScratchProject
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.projects, response)
			}
			mockAuth.AssertExpectations(t)
			mockScratch.AssertExpectations(t)
		})
	}
}

func TestHandler_DeleteScratchProject(t *testing.T) {
	r, mockAuth, _, mockScratch := setupTestHandler()

	tests := []struct {
		name       string
		projectID  string
		mockErr    error
		wantStatus int
	}{
		{
			name:       "正常删除项目",
			projectID:  "1",
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
		{
			name:       "无效的项目ID",
			projectID:  "invalid",
			mockErr:    nil,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "删除项目失败",
			projectID:  "1",
			mockErr:    errors.New("删除失败"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("DELETE", "/api/scratch/projects/"+tt.projectID, nil)
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			// 设置认证中间件的mock
			mockAuth.On("ValidateToken", "valid.token.string").Return(&service.Claims{UserID: 1}, nil)

			// 设置DeleteProject的mock
			if tt.projectID != "invalid" {
				id, _ := strconv.ParseUint(tt.projectID, 10, 64)
				mockScratch.On("DeleteProject", uint(1), uint(id)).Return(tt.mockErr).Once()
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockAuth.AssertExpectations(t)
			mockScratch.AssertExpectations(t)
		})
	}
}
