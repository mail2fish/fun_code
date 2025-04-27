package model

import (
	"time"

	"gorm.io/gorm"
)

// UserSession 用户会话模型
type UserSession struct {
	ID        uint           `gorm:"primarykey;autoIncrement" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	UserID    uint           `gorm:"uniqueIndex;not null"`          // 用户ID
	SessionID string         `gorm:"size:255;not null;uniqueIndex"` // 会话ID
	ExpiresAt time.Time      `gorm:"not null"`                      // 过期时间
	IsActive  bool           `gorm:"default:true"`                  // 是否活跃
}

func (u *UserSession) TableName() string {
	return "user_sessions"
}
