package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/model"
	"github.com/jun/fun_code/internal/service"
	"github.com/jun/fun_code/internal/service/testutils"
	"github.com/stretchr/testify/assert"
)

// 测试 ListScratchProjects 处理函数
func TestListScratchProjects(t *testing.T) {
	// 设置测试模式
	gin.SetMode(gin.TestMode)

	// 创建临时目录用于测试
	tempDir, err := os.MkdirTemp("", "scratch_handler_test")
	if err != nil {
		t.Fatalf("无法创建临时目录: %v", err)
	}
	defer os.RemoveAll(tempDir) // 测试结束后清理

	// 设置数据库和服务
	db := testutils.SetupTestDB()
	scratchService := service.NewScratchService(db, tempDir)

	// 创建配置
	cfg := &config.Config{
		Server: config.ServerConfig{
			AssetHost: "http://localhost:8080",
		},
	}

	// 创建处理器
	h := &Handler{
		scratchService: scratchService,
		config:         cfg,
	}

	// 创建测试用户
	userID := uint(1)
	otherUserID := uint(2)

	// 创建多个测试项目
	projectCount := 10
	for i := 0; i < projectCount; i++ {
		name := fmt.Sprintf("测试项目 %d", i+1)
		content := []byte(fmt.Sprintf(`{"test":"content-%d"}`, i+1))

		// 保存项目
		_, err := scratchService.SaveProject(userID, 0, name, content)
		if err != nil {
			t.Fatalf("SaveProject() error = %v", err)
		}
	}

	// 为其他用户创建项目
	_, err = scratchService.SaveProject(otherUserID, 0, "其他用户项目", []byte(`{"test":"other"}`))
	if err != nil {
		t.Fatalf("SaveProject() error = %v", err)
	}

	// 测试用例
	tests := []struct {
		name       string
		userID     uint
		pageSize   string
		beginID    string
		forward    string
		asc        string
		wantStatus int
		wantCount  int
		wantMore   bool
	}{
		{
			name:       "默认参数",
			userID:     userID,
			pageSize:   "5",
			beginID:    "0",
			forward:    "true",
			asc:        "true",
			wantStatus: http.StatusOK,
			wantCount:  5,
			wantMore:   true,
		},
		{
			name:       "降序排列",
			userID:     userID,
			pageSize:   "5",
			beginID:    "0",
			forward:    "true",
			asc:        "false",
			wantStatus: http.StatusOK,
			wantCount:  5,
			wantMore:   true,
		},
		{
			name:       "pageSize超出限制",
			userID:     userID,
			pageSize:   "200",
			beginID:    "0",
			forward:    "true",
			asc:        "true",
			wantStatus: http.StatusOK,
			wantCount:  10, // 使用默认值10
			wantMore:   false,
		},
		{
			name:       "无效的pageSize",
			userID:     userID,
			pageSize:   "invalid",
			beginID:    "0",
			forward:    "true",
			asc:        "true",
			wantStatus: http.StatusOK,
			wantCount:  10, // 使用默认值10
			wantMore:   false,
		},
		{
			name:       "无效的beginID",
			userID:     userID,
			pageSize:   "5",
			beginID:    "invalid",
			forward:    "true",
			asc:        "true",
			wantStatus: http.StatusOK,
			wantCount:  5,
			wantMore:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 创建请求
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			// 设置请求参数
			c.Request = httptest.NewRequest("GET", "/api/scratch/projects", nil)
			c.Request.URL.RawQuery = fmt.Sprintf("pageSize=%s&beginID=%s&forward=%s&asc=%s",
				tt.pageSize, tt.beginID, tt.forward, tt.asc)

			// 设置用户ID
			c.Set("userID", tt.userID)

			// 调用处理函数
			h.ListScratchProjects(c)

			// 验证状态码
			assert.Equal(t, tt.wantStatus, w.Code)

			// 解析响应
			if w.Code == http.StatusOK {
				var response struct {
					Data    []model.ScratchProject `json:"data"`
					HasMore bool                   `json:"hasMore"`
					Total   int64                  `json:"total"`
				}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)

				// 验证项目数量
				assert.Equal(t, tt.wantCount, len(response.Data))

				// 验证hasMore标志
				assert.Equal(t, tt.wantMore, response.HasMore)

				// 验证排序
				if len(response.Data) > 1 {
					isAscending := response.Data[0].ID < response.Data[len(response.Data)-1].ID
					wantAscending := tt.asc == "true"
					assert.Equal(t, wantAscending, isAscending, "排序方向错误")
				}

				// 验证total字段
				expectedTotal := int64(projectCount)
				if tt.userID == 0 {
					expectedTotal = int64(projectCount + 1) // 包括其他用户的项目
				} else if tt.userID != userID {
					expectedTotal = 0
				}
				assert.Equal(t, expectedTotal, response.Total)
			}
		})
	}
}
