package model

import (
	"time"

	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	Username  string         `gorm:"uniqueIndex;size:50" json:"username"`
	Nickname  string         `gorm:"size:50" json:"nickname"`
	Password  string         `gorm:"size:100" json:"-"`
	Email     string         `gorm:"size:100" json:"email"`
	Role      string         `gorm:"size:20;default:'student'" json:"role"` // 用户角色: admin, teacher, student
	Files     []File         `json:"files,omitempty"`
}
