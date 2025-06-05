package model

import (
	"fmt"
	"time"
)

// File 文件模型
type File struct {
	ID           uint      `json:"id" gorm:"primarykey;autoIncrement"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	ExtName      string    `gorm:"size:255" json:"ext_name"`
	SHA1         string    `gorm:"size:40;unique" json:"sha1"`
	OriginalName string    `gorm:"size:255" json:"original_name"`
	Description  string    `gorm:"size:1000" json:"description"`
	Size         int64     `json:"size"`
	UserID       uint      `gorm:"index" json:"user_id"`
	TagID        uint      `gorm:"index" json:"tag_id"`
	ContentType  uint      `gorm:"index" json:"content_type"`
}

func (f *File) TableName() string {
	return "files"
}

func (f *File) GetName() string {
	return fmt.Sprintf("%s%s", f.SHA1, f.ExtName)
}

const (
	ContentTypeImage   = 1 // 图片
	ContentTypeSprite3 = 2 // 精灵3
	ContentTypeAudio   = 3 // 音频
)
