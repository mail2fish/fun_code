package model

import (
	"time"

	"gorm.io/gorm"
)

// ClassCourse 班级与课程的关联表
type ClassCourse struct {
	ClassID     uint   `json:"class_id" gorm:"not null;index"`    // 班级ID
	CourseID    uint   `json:"course_id" gorm:"not null;index"`   // 课程ID
	StartDate   int64  `json:"start_date"`                        // 开始日期 Unix 时间戳
	EndDate     int64  `json:"end_date"`                          // 结束日期 Unix 时间戳
	IsPublished bool   `json:"is_published" gorm:"default:false"` // 是否发布
	CreatedAt   int64  `json:"created_at"`                        // 创建时间 Unix 时间戳
	UpdatedAt   int64  `json:"updated_at"`                        // 更新时间 Unix 时间戳
	DeletedAt   *int64 `json:"deleted_at,omitempty" gorm:"index"` // 删除时间 Unix 时间戳
}

func (c *ClassCourse) TableName() string {
	return "class_courses"
}

// BeforeCreate GORM钩子，在创建前设置时间戳
func (c *ClassCourse) BeforeCreate(tx *gorm.DB) error {
	now := time.Now().Unix()
	c.CreatedAt = now
	c.UpdatedAt = now
	return nil
}

// BeforeUpdate GORM钩子，在更新前设置时间戳
func (c *ClassCourse) BeforeUpdate(tx *gorm.DB) error {
	c.UpdatedAt = time.Now().Unix()
	return nil
}
