package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/jun/fun_code/internal/dao"
	"github.com/jun/fun_code/internal/model"
	"github.com/stretchr/testify/assert"
)

func TestHandler_UploadScratchAsset(t *testing.T) {
	tests := []struct {
		name          string
		assetID       string
		content       []byte
		userID        uint
		mockErr       error
		wantStatus    int
		contentType   string
		expectedAsset *model.UserAsset
	}{
		{
			name:        "正常上传资源",
			assetID:     "test123456789012345678901234567890123456.png",
			content:     []byte("test image content"),
			userID:      1,
			mockErr:     nil,
			wantStatus:  http.StatusOK,
			contentType: "image/png",
			expectedAsset: &model.UserAsset{
				UserID:    1,
				AssetID:   "test123456789012345678901234567890123456.png",
				AssetType: "image/png",
				Size:      18,
			},
		},
		{
			name:        "不安全的 assetID",
			assetID:     url.PathEscape("test/../../../../etc/passwd"),
			content:     []byte("malicious content"),
			userID:      1,
			mockErr:     nil,
			wantStatus:  http.StatusNotFound,
			contentType: "application/octet-stream",
		},
		{
			name:        "未授权用户",
			assetID:     "test123456789012345678901234567890123456.png",
			content:     []byte("test image content"),
			userID:      0,
			mockErr:     nil,
			wantStatus:  http.StatusUnauthorized,
			contentType: "image/png",
		},
		{
			name:        "保存资源失败",
			assetID:     "test123456789012345678901234567890123456.png",
			content:     []byte("test image content"),
			userID:      1,
			mockErr:     errors.New("save failed"),
			wantStatus:  http.StatusInternalServerError,
			contentType: "image/png",
			expectedAsset: &model.UserAsset{
				UserID:    1,
				AssetID:   "test123456789012345678901234567890123456.png",
				AssetType: "image/png",
				Size:      18,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r, mockDao := setupTestHandler()

			req := httptest.NewRequest("POST", "/assets/scratch/"+tt.assetID, bytes.NewBuffer(tt.content))
			req.Header.Set("Content-Type", tt.contentType)
			req.Header.Set("Authorization", "Bearer valid.token.string")
			w := httptest.NewRecorder()

			// 设置认证中间件的mock
			mockDao.AuthDao.On("ValidateToken", "valid.token.string").Return(&dao.Claims{UserID: tt.userID}, nil).Maybe()

			// 只有当用户已授权且不是不安全的assetID时才设置mock
			if tt.userID != 0 && tt.wantStatus != http.StatusBadRequest {
				mockDao.ScratchDao.On("GetScratchBasePath").Return("/tmp/scratch").Maybe()
				if tt.expectedAsset != nil {
					mockDao.UserAssetDao.On("CreateUserAsset", tt.expectedAsset).Return(tt.mockErr).Once()
				}
			}

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
			if tt.wantStatus == http.StatusOK {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "ok", response["status"])
				assert.Equal(t, tt.assetID, response["assetID"])
				assert.Equal(t, tt.contentType, response["content_type"])
			}

			mockDao.AuthDao.AssertExpectations(t)
			if tt.userID != 0 && tt.wantStatus != http.StatusBadRequest {
				mockDao.ScratchDao.AssertExpectations(t)
				if tt.expectedAsset != nil {
					mockDao.UserAssetDao.AssertExpectations(t)
				}
			}
		})
	}
}
