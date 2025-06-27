package model

import (
	"time"

	"gorm.io/gorm"
)

// LessonCourse 课件与课程的关联表
type LessonCourse struct {
	LessonID  uint   `json:"lesson_id" gorm:"not null;uniqueIndex:idx_lesson_course"` // 课件ID
	CourseID  uint   `json:"course_id" gorm:"not null;uniqueIndex:idx_lesson_course"` // 课程ID
	SortOrder int    `json:"sort_order" gorm:"default:0;index"`                       // 在课程中的排序号
	CreatedAt int64  `json:"created_at"`                                              // 创建时间 Unix 时间戳
	UpdatedAt int64  `json:"updated_at"`                                              // 更新时间 Unix 时间戳
	DeletedAt *int64 `json:"deleted_at,omitempty" gorm:"index"`                       // 删除时间 Unix 时间戳
}

func (lc *LessonCourse) TableName() string {
	return "lesson_courses"
}

// BeforeCreate GORM钩子，在创建前设置时间戳
func (lc *LessonCourse) BeforeCreate(tx *gorm.DB) error {
	now := time.Now().Unix()
	lc.CreatedAt = now
	lc.UpdatedAt = now
	return nil
}

// BeforeUpdate GORM钩子，在更新前设置时间戳
func (lc *LessonCourse) BeforeUpdate(tx *gorm.DB) error {
	lc.UpdatedAt = time.Now().Unix()
	return nil
}
