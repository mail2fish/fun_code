package dao

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/jun/fun_code/internal/model"

	"gorm.io/gorm"
)

type FileServiceImpl struct {
	db       *gorm.DB
	basePath string
}

func NewFileService(db *gorm.DB, basePath string) FileService {
	return &FileServiceImpl{db: db, basePath: basePath}
}

func (s *FileServiceImpl) CreateDirectory(userID uint, name string, parentID *uint) error {
	dir := model.File{
		Name:        name,
		IsDirectory: true,
		UserID:      userID,
		ParentID:    parentID,
		UploadedAt:  time.Now(),
	}

	result := s.db.Create(&dir)
	return result.Error
}

func (s *FileServiceImpl) UploadFile(userID uint, name string, parentID *uint, contentType string, size int64, reader io.Reader) error {
	userPath := filepath.Join(s.basePath, fmt.Sprintf("%d", userID))
	if err := os.MkdirAll(userPath, 0755); err != nil {
		return err
	}

	filePath := filepath.Join(userPath, fmt.Sprintf("%d_%s", time.Now().Unix(), name))

	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	if _, err := io.Copy(file, reader); err != nil {
		os.Remove(filePath)
		return err
	}

	fileRecord := model.File{
		Name:        name,
		Path:        filePath,
		Size:        size,
		ContentType: contentType,
		IsDirectory: false,
		ParentID:    parentID,
		UserID:      userID,
		UploadedAt:  time.Now(),
	}

	result := s.db.Create(&fileRecord)
	if result.Error != nil {
		os.Remove(filePath)
		return result.Error
	}

	return nil
}

func (s *FileServiceImpl) GetFile(userID, fileID uint) (*model.File, error) {
	var file model.File
	if err := s.db.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("文件不存在")
		}
		return nil, err
	}
	return &file, nil
}

func (s *FileServiceImpl) ListFiles(userID uint, parentID *uint) ([]model.File, error) {
	var files []model.File
	query := s.db.Where("user_id = ?", userID)
	if parentID != nil && *parentID != 0 {
		query = query.Where("parent_id = ?", *parentID)
	} else {
		query = query.Where("parent_id IS NULL")
	}

	if err := query.Find(&files).Error; err != nil {
		return nil, err
	}

	return files, nil
}

func (s *FileServiceImpl) DeleteFile(userID, fileID uint) error {
	file, err := s.GetFile(userID, fileID)
	if err != nil {
		return err
	}

	if !file.IsDirectory {
		if err := os.Remove(file.Path); err != nil && !os.IsNotExist(err) {
			return err
		}
	}

	result := s.db.Delete(file)
	return result.Error
}
