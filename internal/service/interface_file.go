package service

import (
	"io"

	"github.com/jun/fun_code/internal/model"
)

type FileService interface {
	CreateDirectory(userID uint, name string, parentID *uint) error
	UploadFile(userID uint, name string, parentID *uint, contentType string, size int64, reader io.Reader) error
	GetFile(userID, fileID uint) (*model.File, error)
	ListFiles(userID uint, parentID *uint) ([]model.File, error)
	DeleteFile(userID, fileID uint) error
}
