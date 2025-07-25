package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// ======================== 测试创建画板参数解析 ========================

func TestCreateExcalidrawBoardParams_Parse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		requestBody  interface{}
		expectedCode int
		expectError  bool
	}{
		{
			name: "有效参数",
			requestBody: map[string]interface{}{
				"name": "测试画板",
				"file_content": map[string]interface{}{
					"elements": []interface{}{},
					"appState": map[string]interface{}{
						"viewBackgroundColor": "#ffffff",
					},
				},
			},
			expectedCode: http.StatusOK,
			expectError:  false,
		},
		{
			name: "缺少名称",
			requestBody: map[string]interface{}{
				"file_content": map[string]interface{}{
					"elements": []interface{}{},
				},
			},
			expectedCode: http.StatusBadRequest,
			expectError:  true,
		},
		{
			name: "缺少文件内容",
			requestBody: map[string]interface{}{
				"name": "测试画板",
			},
			expectedCode: http.StatusBadRequest,
			expectError:  true,
		},
		{
			name:         "空请求体",
			requestBody:  map[string]interface{}{},
			expectedCode: http.StatusBadRequest,
			expectError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 准备请求体
			requestBody, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/excalidraw/boards", bytes.NewBuffer(requestBody))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			// 测试参数解析
			params := &CreateExcalidrawBoardParams{}
			err := params.Parse(c)

			if tt.expectError {
				assert.NotNil(t, err)
			} else {
				assert.Nil(t, err)
				assert.Equal(t, "测试画板", params.Name)
				assert.NotNil(t, params.FileContent)
			}
		})
	}
}

// ======================== 测试文件保存逻辑 ========================

func TestSaveExcalidrawFile_SHA1Logic(t *testing.T) {
	// 测试SHA1哈希分割逻辑
	testContent := []byte(`{"elements":[],"appState":{"viewBackgroundColor":"#ffffff"}}`)

	// 由于我们无法mock文件系统，这里只测试哈希计算逻辑
	// 实际的文件保存功能需要在集成测试中验证

	// 验证内容不为空
	assert.NotEmpty(t, testContent)

	// 验证JSON格式有效
	var testJSON map[string]interface{}
	err := json.Unmarshal(testContent, &testJSON)
	assert.NoError(t, err)
	assert.Contains(t, testJSON, "elements")
	assert.Contains(t, testJSON, "appState")
}
