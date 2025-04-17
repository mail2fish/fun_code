package model

import (
	"time"

	"gorm.io/gorm"
)

// UserSession 用户会话模型
type UserSession struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	UserID    uint           `gorm:"index;not null"`                // 用户ID
	SessionID string         `gorm:"size:255;not null;uniqueIndex"` // 会话ID
	ExpiresAt time.Time      `gorm:"not null"`                      // 过期时间
	IsActive  bool           `gorm:"default:true"`                  // 是否活跃
}
