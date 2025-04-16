package model

import (
	"time"

	"gorm.io/gorm"
)

// ClassCourse 班级与课程的关联表
type ClassCourse struct {
	ClassID     uint      `json:"class_id" gorm:"not null"`          // 班级ID
	CourseID    uint      `json:"course_id" gorm:"not null"`         // 课程ID
	StartDate   time.Time `json:"start_date"`                        // 开始日期
	EndDate     time.Time `json:"end_date"`                          // 结束日期
	IsPublished bool      `json:"is_published" gorm:"default:false"` // 是否发布
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

