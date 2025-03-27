package model

import (
	"time"

	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	gorm.Model
	Username string `gorm:"uniqueIndex;size:50" json:"username"`
	Password string `gorm:"size:100" json:"-"`
	Email    string `gorm:"size:100" json:"email"`
	Files    []File `json:"files,omitempty"`
}

// File 文件模型
type File struct {
	gorm.Model
	Name        string    `gorm:"size:255" json:"name"`
	Path        string    `gorm:"size:1000" json:"path"`
	Size        int64     `json:"size"`
	ContentType string    `gorm:"size:100" json:"content_type"`
	IsDirectory bool      `json:"is_directory"`
	ParentID    *uint     `json:"parent_id,omitempty"`
	UserID      uint      `json:"user_id"`
	User        User      `json:"-"`
	UploadedAt  time.Time `json:"uploaded_at"`
}