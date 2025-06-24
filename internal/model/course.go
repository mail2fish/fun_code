package model

import (
	"time"

	"gorm.io/gorm"
)

// Course 课程模型
type Course struct {
	ID            uint           `json:"id" gorm:"primarykey;autoIncrement"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	Title         string         `json:"title" gorm:"size:200;not null"`               // 课程标题
	Description   string         `json:"description" gorm:"size:1000"`                 // 课程描述
	AuthorID      uint           `json:"author_id" gorm:"not null"`                    // 作者ID
	Author        User           `json:"author" gorm:"foreignKey:AuthorID"`            // 作者信息
	Content       string         `json:"content" gorm:"type:text"`                     // 课程内容
	IsPublic      bool           `json:"is_public" gorm:"default:false"`               // 是否公开
	IsPublished   bool           `json:"is_published" gorm:"default:false"`            // 是否发布
	SortOrder     int            `json:"sort_order" gorm:"default:0;index"`            // 排序号
	Duration      int            `json:"duration" gorm:"default:0"`                    // 预计时长（分钟）
	Difficulty    string         `json:"difficulty" gorm:"size:20;default:'beginner'"` // 难度等级
	ThumbnailPath string         `json:"thumbnail_path" gorm:"size:500"`               // 缩略图路径
	Classes       []Class        `json:"-" gorm:"many2many:class_courses"`             // 关联的班级
	Lessons       []Lesson       `json:"lessons,omitempty" gorm:"foreignKey:CourseID"` // 课程下的课时列表
}

func (c *Course) TableName() string {
	return "courses"
}
