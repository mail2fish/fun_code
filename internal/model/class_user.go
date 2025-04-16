package model

import (
	"time"

	"gorm.io/gorm"
)

// ClassUser 班级与用户的关联表
type ClassUser struct {
	ClassID   uint      `json:"class_id" gorm:"not null"`      // 班级ID
	UserID    uint      `json:"user_id" gorm:"not null"`       // 用户ID
	JoinedAt  time.Time `json:"joined_at"`                     // 加入时间
	Role      string    `json:"role" gorm:"size:20"`           // 角色：student/assistant
	IsActive  bool      `json:"is_active" gorm:"default:true"` // 是否激活
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
