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
	SHA1        string         `gorm:"size:40;unique" json:"sha1"`
	Description string         `gorm:"size:1000" json:"description"`
	Size        int64          `json:"size"`
	UserID      uint           `gorm:"index" json:"user_id"`
	TagID       uint           `gorm:"index" json:"tag_id"`
	ContentType uint           `gorm:"index" json:"content_type"`
}

func (f *File) TableName() string {
	return "files"
}

const (
	ContentTypeImage   = 1 // 图片
	ContentTypeSprite3 = 2 // 精灵3
	ContentTypeAudio   = 3 // 音频
)
