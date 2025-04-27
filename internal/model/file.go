package model

import (
	"time"

	"gorm.io/gorm"
)

// File 文件模型
type File struct {
	ID          uint           `json:"id" gorm:"primarykey;autoIncrement"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	Name        string         `gorm:"size:255" json:"name"`
	Path        string         `gorm:"size:1000" json:"path"`
	Size        int64          `json:"size"`
	ContentType string         `gorm:"size:100" json:"content_type"`
	IsDirectory bool           `json:"is_directory"`
	ParentID    *uint          `json:"parent_id,omitempty"`
	UserID      uint           `gorm:"index" json:"user_id"`
	User        User           `json:"-"`
	UploadedAt  time.Time      `json:"uploaded_at"`
}

func (f *File) TableName() string {
	return "files"
}
