package dao

import (
	"fmt"
	"os"
	"testing"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/dao/testutils"
	"go.uber.org/zap"
)

func TestGetProject(t *testing.T) {
	// 创建临时目录用于测试
	tempDir, err := os.MkdirTemp("", "scratch_test")
	if err != nil {
		t.Fatalf("无法创建临时目录: %v", err)
	}
	defer os.RemoveAll(tempDir) // 测试结束后清理

	// 修改调用方式，传入数据库和基础路径
	db := testutils.SetupTestDB()
	cfg := &config.Config{}
	service := NewScratchDao(db, tempDir, cfg, zap.NewNop())

	tests := []struct {
		name        string
		projectID   uint
		wantErr     bool
		expectedLen int
	}{
		{
			name:        "正常情况",
			projectID:   0, // 使用0表示示例项目
			wantErr:     false,
			expectedLen: 1000, // 根据实际返回的JSON长度调整
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 执行测试
			result, err := service.GetProjectBinary(tt.projectID)

			// 验证结果
			if (err != nil) != tt.wantErr {
				t.Errorf("GetProject() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) < tt.expectedLen {
				t.Errorf("GetProject() returned data too short, got %d, want at least %d", len(result), tt.expectedLen)
			}
		})
	}
}

// 添加保存项目的测试
func TestSaveProject(t *testing.T) {
	// 创建临时目录用于测试
	tempDir, err := os.MkdirTemp("", "scratch_test")
	if err != nil {
		t.Fatalf("无法创建临时目录: %v", err)
	}
	defer os.RemoveAll(tempDir) // 测试结束后清理

	db := testutils.SetupTestDB()
	cfg := &config.Config{}
	service := NewScratchDao(db, tempDir, cfg, zap.NewNop())

	// 测试数据
	userID := uint(1)
	projectID := uint(0) // 使用0表示新建项目
	name := "测试项目"
	content := []byte(`{"test":"content"}`)

	// 保存项目
	savedID, err := service.SaveProject(userID, projectID, name, content)
	if err != nil {
		t.Fatalf("SaveProject() error = %v", err)
	}

	if savedID == 0 {
		t.Errorf("SaveProject() 返回的ID不应为0")
	}

	// 读取项目并验证内容
	readContent, err := service.GetProjectBinary(savedID)
	if err != nil {
		t.Fatalf("GetProject() error = %v", err)
	}

	if string(readContent) != string(content) {
		t.Errorf("GetProject() content = %v, want %v", string(readContent), string(content))
	}

	// 不再验证具体的文件路径，因为路径生成逻辑可能会变化
	// 只要能通过GetProject读取到正确的内容即可
}

// 添加CanReadProject的测试
func TestCanReadProject(t *testing.T) {
	// 创建临时目录用于测试
	tempDir, err := os.MkdirTemp("", "scratch_test")
	if err != nil {
		t.Fatalf("无法创建临时目录: %v", err)
	}
	defer os.RemoveAll(tempDir) // 测试结束后清理

	db := testutils.SetupTestDB()
	cfg := &config.Config{}
	scratchDao := NewScratchDao(db, tempDir, cfg, zap.NewNop())

	// 先创建一个项目用于测试
	userID := uint(1)
	name := "测试项目"
	content := []byte(`{"test":"content"}`)

	// 保存项目
	projectID, err := scratchDao.SaveProject(userID, 0, name, content)
	if err != nil {
		t.Fatalf("SaveProject() error = %v", err)
	}

	// 测试用例
	tests := []struct {
		name      string
		projectID uint
		want      bool
	}{
		{
			name:      "存在的项目",
			projectID: projectID,
			want:      true,
		},
		{
			name:      "不存在的项目",
			projectID: 9999,
			want:      false,
		},
		{
			name:      "项目ID为0",
			projectID: 0,
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 执行测试
			_, got := scratchDao.GetProjectUserID(tt.projectID)

			// 验证结果
			if got != tt.want {
				t.Errorf("CanReadProject() = %v, want %v", got, tt.want)
			}
		})
	}
}

// 添加 GetScratchBasePath 的测试
func TestGetScratchBasePath(t *testing.T) {
	// 创建临时目录用于测试
	tempDir, err := os.MkdirTemp("", "scratch_test")
	if err != nil {
		t.Fatalf("无法创建临时目录: %v", err)
	}
	defer os.RemoveAll(tempDir) // 测试结束后清理

	// 创建服务实例
	db := testutils.SetupTestDB()
	cfg := &config.Config{}
	service := NewScratchDao(db, tempDir, cfg, zap.NewNop())

	// 调用被测试的方法
	basePath := service.GetScratchBasePath()

	// 验证结果
	if basePath != tempDir {
		t.Errorf("GetScratchBasePath() = %v, 期望 %v", basePath, tempDir)
	}
}

// 添加 ListProjectsWithPagination 的测试
func TestListProjectsWithPagination(t *testing.T) {
	// 创建临时目录用于测试
	tempDir, err := os.MkdirTemp("", "scratch_test")
	if err != nil {
		t.Fatalf("无法创建临时目录: %v", err)
	}
	defer os.RemoveAll(tempDir) // 测试结束后清理

	db := testutils.SetupTestDB()
	cfg := &config.Config{}
	service := NewScratchDao(db, tempDir, cfg, zap.NewNop())

	// 创建测试用户
	userID := uint(1)
	otherUserID := uint(2)

	// 创建多个测试项目
	projectCount := 10
	var projectIDs []uint
	for i := 0; i < projectCount; i++ {
		name := fmt.Sprintf("测试项目 %d", i+1)
		content := []byte(fmt.Sprintf(`{"test":"content-%d"}`, i+1))

		// 保存项目
		projectID, err := service.SaveProject(userID, 0, name, content)
		if err != nil {
			t.Fatalf("SaveProject() error = %v", err)
		}
		projectIDs = append(projectIDs, projectID)
	}

	// 为其他用户创建项目
	_, err = service.SaveProject(otherUserID, 0, "其他用户项目", []byte(`{"test":"other"}`))
	if err != nil {
		t.Fatalf("SaveProject() error = %v", err)
	}

	// 测试用例
	tests := []struct {
		name      string
		userID    uint
		pageSize  uint
		beginID   uint
		forward   bool
		asc       bool
		wantCount int
		wantMore  bool
		wantErr   bool
	}{
		{
			name:      "默认参数-降序",
			userID:    userID,
			pageSize:  5,
			beginID:   0,
			forward:   true,
			asc:       false,
			wantCount: 5,
			wantMore:  true,
			wantErr:   false,
		},
		{
			name:      "默认参数-升序",
			userID:    userID,
			pageSize:  5,
			beginID:   0,
			forward:   true,
			asc:       true,
			wantCount: 5,
			wantMore:  true,
			wantErr:   false,
		},
		{
			name:      "指定beginID-向前-降序",
			userID:    userID,
			pageSize:  3,
			beginID:   projectIDs[5], // 使用中间的ID
			forward:   true,
			asc:       false,
			wantCount: 3,
			wantMore:  true,
			wantErr:   false,
		},
		{
			name:      "指定beginID-向后-降序",
			userID:    userID,
			pageSize:  3,
			beginID:   projectIDs[5], // 使用中间的ID
			forward:   false,
			asc:       false,
			wantCount: 3,
			wantMore:  true,
			wantErr:   false,
		},
		{
			name:      "指定beginID-向前-升序",
			userID:    userID,
			pageSize:  3,
			beginID:   projectIDs[5], // 使用中间的ID
			forward:   true,
			asc:       true,
			wantCount: 3,
			wantMore:  true,
			wantErr:   false,
		},
		{
			name:      "指定beginID-向后-升序",
			userID:    userID,
			pageSize:  3,
			beginID:   projectIDs[5], // 使用中间的ID
			forward:   false,
			asc:       true,
			wantCount: 3,
			wantMore:  true,
			wantErr:   false,
		},
		{
			name:      "pageSize为0-使用默认值",
			userID:    userID,
			pageSize:  0,
			beginID:   0,
			forward:   true,
			asc:       false,
			wantCount: 10, // 默认值20，但我们只有10个项目
			wantMore:  false,
			wantErr:   false,
		},
		{
			name:      "查询其他用户-无结果",
			userID:    999,
			pageSize:  5,
			beginID:   0,
			forward:   true,
			asc:       false,
			wantCount: 0,
			wantMore:  false,
			wantErr:   false,
		},
		{
			name:      "查询所有用户",
			userID:    0,
			pageSize:  20,
			beginID:   0,
			forward:   true,
			asc:       false,
			wantCount: 11, // 10个测试用户项目 + 1个其他用户项目
			wantMore:  false,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 执行测试
			projects, hasMore, err := service.ListProjectsWithPagination(tt.userID, tt.pageSize, tt.beginID, tt.forward, tt.asc)

			// 验证结果
			if (err != nil) != tt.wantErr {
				t.Errorf("ListProjectsWithPagination() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(projects) != tt.wantCount {
				t.Errorf("ListProjectsWithPagination() 返回项目数量 = %v, want %v", len(projects), tt.wantCount)
			}

			if hasMore != tt.wantMore {
				t.Errorf("ListProjectsWithPagination() hasMore = %v, want %v", hasMore, tt.wantMore)
			}

			// 验证排序
			if len(projects) > 1 {
				isAscending := projects[0].ID < projects[len(projects)-1].ID
				if isAscending != tt.asc {
					t.Errorf("ListProjectsWithPagination() 排序方向错误，got ascending=%v, want %v", isAscending, tt.asc)
				}
			}

			// 验证分页条件
			if tt.beginID > 0 && len(projects) > 0 {
				if tt.asc && tt.forward {
					// id >= beginID, 升序
					if projects[0].ID < tt.beginID {
						t.Errorf("ListProjectsWithPagination() 首个项目ID %v 应该 >= %v", projects[0].ID, tt.beginID)
					}
				} else if tt.asc && !tt.forward {
					// id <= beginID, 升序显示（但查询是降序）
					if projects[len(projects)-1].ID > tt.beginID {
						t.Errorf("ListProjectsWithPagination() 最后项目ID %v 应该 <= %v", projects[len(projects)-1].ID, tt.beginID)
					}
				} else if !tt.asc && tt.forward {
					// id <= beginID, 降序
					if projects[0].ID > tt.beginID {
						t.Errorf("ListProjectsWithPagination() 首个项目ID %v 应该 <= %v", projects[0].ID, tt.beginID)
					}
				} else {
					// id >= beginID, 降序显示（但查询是升序）
					if projects[len(projects)-1].ID < tt.beginID {
						t.Errorf("ListProjectsWithPagination() 最后项目ID %v 应该 >= %v", projects[len(projects)-1].ID, tt.beginID)
					}
				}
			}
		})
	}
}

// 添加 CountProjects 的测试
func TestCountProjects(t *testing.T) {
	// 创建临时目录用于测试
	tempDir, err := os.MkdirTemp("", "scratch_test")
	if err != nil {
		t.Fatalf("无法创建临时目录: %v", err)
	}
	defer os.RemoveAll(tempDir) // 测试结束后清理

	db := testutils.SetupTestDB()
	cfg := &config.Config{}
	service := NewScratchDao(db, tempDir, cfg, zap.NewNop())

	// 创建测试用户
	userID := uint(1)
	otherUserID := uint(2)

	// 创建多个测试项目
	projectCount := 5
	for i := 0; i < projectCount; i++ {
		name := fmt.Sprintf("测试项目 %d", i+1)
		content := []byte(fmt.Sprintf(`{"test":"content-%d"}`, i+1))

		// 保存项目
		_, err := service.SaveProject(userID, 0, name, content)
		if err != nil {
			t.Fatalf("SaveProject() error = %v", err)
		}
	}

	// 为其他用户创建项目
	_, err = service.SaveProject(otherUserID, 0, "其他用户项目", []byte(`{"test":"other"}`))
	if err != nil {
		t.Fatalf("SaveProject() error = %v", err)
	}

	// 测试用例
	tests := []struct {
		name    string
		userID  uint
		want    int64
		wantErr bool
	}{
		{
			name:    "正常情况-用户有项目",
			userID:  userID,
			want:    int64(projectCount),
			wantErr: false,
		},
		{
			name:    "用户无项目",
			userID:  999,
			want:    0,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 执行测试
			got, err := service.CountProjects(tt.userID)

			// 验证结果
			if (err != nil) != tt.wantErr {
				t.Errorf("CountProjects() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("CountProjects() = %v, want %v", got, tt.want)
			}
		})
	}
}
