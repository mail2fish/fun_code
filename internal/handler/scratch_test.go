package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/jun/fun_code/internal/service"
	"github.com/stretchr/testify/assert"
)

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
				mockScratch.On("GetProjectBinary", uint(id)).Return(tt.mockData, tt.mockErr).Once()
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
		projectID  string
		reqBody    map[string]interface{}
		mockID     uint
		mockErr    error
		wantStatus int
	}{
		{
			name:      "正常保存项目",
			projectID: "1",
			reqBody: map[string]interface{}{
				"test": "data",
			},
			mockID:     1,
			mockErr:    nil,
			wantStatus: http.StatusOK,
		},
		{
			name:       "参数无效",
			projectID:  "invalid",
			reqBody:    map[string]interface{}{},
			mockID:     0,
			mockErr:    nil,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:      "保存失败",
			projectID: "1",
			reqBody: map[string]interface{}{
				"test": "data",
			},
			mockID:     0,
			mockErr:    errors.New("保存失败"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.reqBody)
			req := httptest.NewRequest("PUT", "/api/scratch/projects/"+tt.projectID, bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			// 设置认证中间件的mock
			mockAuth.On("ValidateToken", "valid.token.string").Return(&service.Claims{UserID: 1}, nil)

			// 设置SaveProject的mock
			if tt.projectID != "invalid" {
				id, _ := strconv.ParseUint(tt.projectID, 10, 64)
				contentBytes, _ := json.Marshal(tt.reqBody)
				mockScratch.On("SaveProject", uint(1), uint(id), "Scratch Project", contentBytes).Return(tt.mockID, tt.mockErr).Once()
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
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

func TestHandler_CreateScratchProject(t *testing.T) {
	r, mockAuth, _, mockScratch := setupTestHandler()

	tests := []struct {
		name       string
		reqBody    map[string]interface{}
		mockID     uint
		mockErr    error
		wantStatus int
		setupMock  bool // 添加标志控制是否设置mock
	}{
		{
			name: "正常创建项目",
			reqBody: map[string]interface{}{
				"test": "data",
			},
			mockID:     1,
			mockErr:    nil,
			wantStatus: http.StatusOK,
			setupMock:  true,
		},
		{
			name:       "参数无效",
			reqBody:    map[string]interface{}{},
			mockID:     0,
			mockErr:    errors.New("无效的请求体"),
			wantStatus: http.StatusBadRequest,
			setupMock:  false, // 空请求体不会调用SaveProject
		},
		{
			name: "创建失败",
			reqBody: map[string]interface{}{
				"test": "data",
			},
			mockID:     0,
			mockErr:    errors.New("创建失败"),
			wantStatus: http.StatusInternalServerError,
			setupMock:  true,
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

			// 只有当setupMock为true时才设置SaveProject的mock
			if tt.setupMock {
				contentBytes, _ := json.Marshal(tt.reqBody)
				mockScratch.On("SaveProject", uint(1), uint(0), "Scratch Project", contentBytes).Return(tt.mockID, tt.mockErr).Once()
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			mockAuth.AssertExpectations(t)
			mockScratch.AssertExpectations(t)
		})
	}
}
