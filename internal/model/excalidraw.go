package model

import (
	"time"

	"gorm.io/gorm"
)

// ExcalidrawBoard 表示一个Excalidraw画板
type ExcalidrawBoard struct {
	ID        uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	MD5       string `json:"md5"`
	Name      string `json:"name"`
	UserID    uint   `gorm:"index" json:"user_id"`
	FilePath  string `json:"file_path"`            // 画板数据文件路径
	CreatedAt int64  `json:"created_at"`           // Unix时间戳
	UpdatedAt int64  `json:"updated_at"`           // Unix时间戳
	DeletedAt *int64 `json:"deleted_at,omitempty"` // 软删除时间戳

	// 关联关系
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName 指定表名
func (e *ExcalidrawBoard) TableName() string {
	return "excalidraw_boards"
}

// BeforeCreate GORM钩子，创建前自动设置时间戳
func (e *ExcalidrawBoard) BeforeCreate(db *gorm.DB) error {
	now := time.Now().Unix()
	e.CreatedAt = now
	e.UpdatedAt = now
	return nil
}

// BeforeUpdate GORM钩子，更新前自动设置时间戳
func (e *ExcalidrawBoard) BeforeUpdate(db *gorm.DB) error {
	e.UpdatedAt = time.Now().Unix()
	return nil
}
