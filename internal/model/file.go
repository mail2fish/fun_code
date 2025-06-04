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
	Description string         `gorm:"size:1000" json:"description"`
	Size        int64          `json:"size"`
	UserID      uint           `gorm:"index" json:"user_id"`
}

func (f *File) TableName() string {
	return "files"
}
