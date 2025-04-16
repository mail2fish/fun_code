package model

import (
	"time"
)

// ScratchProject 表示一个Scratch项目
type ScratchProject struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"` // 修改为 uint 类型，并添加自增属性
	UserID    uint      `json:"user_id"`
	Name      string    `json:"name"`
	ClassID   uint      `json:"class_id"`
	CourseID  uint      `json:"course_id"`
	FilePath  string    `json:"file_path"` // 文件在文件系统中的路径
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
