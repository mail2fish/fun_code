package model

import (
	"time"
)

// ScratchProject 表示一个Scratch项目
type ScratchProject struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"` // 修改为 uint 类型，并添加自增属性
	MD5       string    `json:"md5"`
	UserID    uint      `gorm:"index" json:"user_id"`
	Name      string    `json:"name"`
	ClassID   uint      `gorm:"index" json:"class_id"`
	CourseID  uint      `gorm:"index" json:"course_id"`
	FilePath  string    `json:"file_path"` // 文件在文件系统中的路径
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (s *ScratchProject) TableName() string {
	return "scratch_projects"
}

type History struct {
	Filename  string    `json:"filename"`
	CreatedAt time.Time `json:"created_at"`
}
