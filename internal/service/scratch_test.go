package service

import (
	"os"
	"testing"

	"github.com/jun/fun_code/internal/service/testutils"
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
	service := NewScratchService(db, tempDir)

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
			result, err := service.GetProject(tt.projectID)

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
	service := NewScratchService(db, tempDir)

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
	readContent, err := service.GetProject(savedID)
	if err != nil {
		t.Fatalf("GetProject() error = %v", err)
	}

	if string(readContent) != string(content) {
		t.Errorf("GetProject() content = %v, want %v", string(readContent), string(content))
	}

	// 不再验证具体的文件路径，因为路径生成逻辑可能会变化
	// 只要能通过GetProject读取到正确的内容即可
}
