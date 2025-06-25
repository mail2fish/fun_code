package model

import (
	"time"

	"gorm.io/gorm"
)

// ClassUser 班级与用户的关联表
type ClassUser struct {
	ClassID   uint   `json:"class_id" gorm:"not null;index"`    // 班级ID
	UserID    uint   `json:"user_id" gorm:"not null;index"`     // 用户ID
	JoinedAt  int64  `json:"joined_at"`                         // 加入时间 Unix 时间戳
	Role      string `json:"role" gorm:"size:20"`               // 角色：student/assistant
	IsActive  bool   `json:"is_active" gorm:"default:true"`     // 是否激活
	CreatedAt int64  `json:"created_at"`                        // 创建时间 Unix 时间戳
	UpdatedAt int64  `json:"updated_at"`                        // 更新时间 Unix 时间戳
	DeletedAt *int64 `json:"deleted_at,omitempty" gorm:"index"` // 删除时间 Unix 时间戳
}

func (c *ClassUser) TableName() string {
	return "class_users"
}

// BeforeCreate GORM钩子，在创建前设置时间戳
func (c *ClassUser) BeforeCreate(tx *gorm.DB) error {
	now := time.Now().Unix()
	c.CreatedAt = now
	c.UpdatedAt = now
	// 如果没有设置加入时间，则使用当前时间
	if c.JoinedAt == 0 {
		c.JoinedAt = now
	}
	return nil
}

// BeforeUpdate GORM钩子，在更新前设置时间戳
func (c *ClassUser) BeforeUpdate(tx *gorm.DB) error {
	c.UpdatedAt = time.Now().Unix()
	return nil
}
