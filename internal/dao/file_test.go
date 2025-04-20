package dao

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/jun/fun_code/internal/model"

	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupFileTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(&model.File{})
	assert.NoError(t, err)

	return db
}

func TestFileService_CreateDirectory(t *testing.T) {
	db := setupFileTestDB(t)
	tempDir := t.TempDir()
	fileService := NewFileDao(db, tempDir)

	tests := []struct {
		name     string
		userID   uint
		dirName  string
		parentID *uint
		wantErr  bool
	}{
		{
			name:     "创建根目录",
			userID:   1,
			dirName:  "root",
			parentID: nil,
			wantErr:  false,
		},
		{
			name:     "创建子目录",
			userID:   1,
			dirName:  "subdir",
			parentID: func() *uint { id := uint(1); return &id }(),
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := fileService.CreateDirectory(tt.userID, tt.dirName, tt.parentID)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// 验证目录是否已创建
				var dir model.File
				err = db.Where("name = ? AND user_id = ?", tt.dirName, tt.userID).First(&dir).Error
				assert.NoError(t, err)
				assert.Equal(t, tt.dirName, dir.Name)
				assert.Equal(t, tt.userID, dir.UserID)
				assert.Equal(t, tt.parentID, dir.ParentID)
				assert.True(t, dir.IsDirectory)
			}
		})
	}
}

func TestFileService_UploadFile(t *testing.T) {
	db := setupFileTestDB(t)
	tempDir := t.TempDir()
	fileService := NewFileDao(db, tempDir)

	tests := []struct {
		name        string
		userID      uint
		fileName    string
		parentID    *uint
		contentType string
		content     []byte
		wantErr     bool
	}{
		{
			name:        "上传文本文件",
			userID:      1,
			fileName:    "test.txt",
			parentID:    nil,
			contentType: "text/plain",
			content:     []byte("test content"),
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := bytes.NewReader(tt.content)
			err := fileService.UploadFile(tt.userID, tt.fileName, tt.parentID, tt.contentType, int64(len(tt.content)), reader)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// 验证文件记录是否已创建
				var file model.File
				err = db.Where("name = ? AND user_id = ?", tt.fileName, tt.userID).First(&file).Error
				assert.NoError(t, err)
				assert.Equal(t, tt.fileName, file.Name)
				assert.Equal(t, tt.userID, file.UserID)
				assert.Equal(t, tt.parentID, file.ParentID)
				assert.Equal(t, tt.contentType, file.ContentType)
				assert.Equal(t, int64(len(tt.content)), file.Size)
				assert.False(t, file.IsDirectory)

				// 验证文件内容
				content, err := os.ReadFile(file.Path)
				assert.NoError(t, err)
				assert.Equal(t, tt.content, content)
			}
		})
	}
}

func TestFileService_GetFile(t *testing.T) {
	db := setupFileTestDB(t)
	tempDir := t.TempDir()
	fileService := NewFileDao(db, tempDir)

	// 创建测试文件
	file := model.File{
		Name:        "test.txt",
		Path:        filepath.Join(tempDir, "test.txt"),
		Size:        12,
		ContentType: "text/plain",
		IsDirectory: false,
		UserID:      1,
	}

	err := db.Create(&file).Error
	assert.NoError(t, err)

	tests := []struct {
		name    string
		userID  uint
		fileID  uint
		wantErr bool
	}{
		{
			name:    "获取存在的文件",
			userID:  1,
			fileID:  1,
			wantErr: false,
		},
		{
			name:    "获取不存在的文件",
			userID:  1,
			fileID:  999,
			wantErr: true,
		},
		{
			name:    "获取其他用户的文件",
			userID:  2,
			fileID:  1,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			file, err := fileService.GetFile(tt.userID, tt.fileID)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, file)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, file)
				assert.Equal(t, tt.fileID, file.ID)
				assert.Equal(t, tt.userID, file.UserID)
			}
		})
	}
}

func TestFileService_ListFiles(t *testing.T) {
	db := setupFileTestDB(t)
	tempDir := t.TempDir()
	fileService := NewFileDao(db, tempDir)

	// 创建测试文件和目录
	parentID := uint(1)
	files := []model.File{
		{Name: "root1", IsDirectory: true, UserID: 1},
		{Name: "root2", IsDirectory: true, UserID: 1},
		{Name: "sub1", IsDirectory: true, UserID: 1, ParentID: &parentID},
		{Name: "file1.txt", IsDirectory: false, UserID: 1},
		{Name: "file2.txt", IsDirectory: false, UserID: 1, ParentID: &parentID},
	}

	for _, f := range files {
		err := db.Create(&f).Error
		assert.NoError(t, err)
	}

	tests := []struct {
		name      string
		userID    uint
		parentID  *uint
		wantCount int
	}{
		{
			name:      "列出根目录文件",
			userID:    1,
			parentID:  nil,
			wantCount: 3,
		},
		{
			name:      "列出子目录文件",
			userID:    1,
			parentID:  &parentID,
			wantCount: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			files, err := fileService.ListFiles(tt.userID, tt.parentID)
			assert.NoError(t, err)
			assert.Len(t, files, tt.wantCount)
		})
	}
}

func TestFileService_DeleteFile(t *testing.T) {
	db := setupFileTestDB(t)
	tempDir := t.TempDir()
	fileService := NewFileDao(db, tempDir)

	// 创建测试文件
	testFilePath := filepath.Join(tempDir, "test.txt")
	err := os.WriteFile(testFilePath, []byte("test content"), 0644)
	assert.NoError(t, err)

	file := model.File{
		Name:        "test.txt",
		Path:        testFilePath,
		Size:        12,
		ContentType: "text/plain",
		IsDirectory: false,
		UserID:      1,
	}

	err = db.Create(&file).Error
	assert.NoError(t, err)

	// 创建测试目录
	dir := model.File{
		Name:        "testdir",
		IsDirectory: true,
		UserID:      1,
	}

	err = db.Create(&dir).Error
	assert.NoError(t, err)

	tests := []struct {
		name    string
		userID  uint
		fileID  uint
		wantErr bool
	}{
		{
			name:    "删除文件",
			userID:  1,
			fileID:  1,
			wantErr: false,
		},
		{
			name:    "删除目录",
			userID:  1,
			fileID:  2,
			wantErr: false,
		},
		{
			name:    "删除不存在的文件",
			userID:  1,
			fileID:  999,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := fileService.DeleteFile(tt.userID, tt.fileID)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// 验证文件是否已删除
				var count int64
				err = db.Model(&model.File{}).Where("id = ?", tt.fileID).Count(&count).Error
				assert.NoError(t, err)
				assert.Equal(t, int64(0), count)
			}
		})
	}
}
