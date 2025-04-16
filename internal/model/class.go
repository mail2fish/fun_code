package model

import (
	"time"

	"gorm.io/gorm"
)

// Class 班级模型
type Class struct {
	gorm.Model
	Name        string    `json:"name" gorm:"size:100;not null"`          // 班级名称
	Description string    `json:"description" gorm:"size:500"`            // 班级描述
	Code        string    `json:"code" gorm:"size:20;unique;not null"`    // 班级邀请码
	StartDate   time.Time `json:"start_date"`                             // 开课日期
	EndDate     time.Time `json:"end_date"`                               // 结课日期
	TeacherID   uint      `json:"teacher_id" gorm:"not null"`             // 教师ID
	Teacher     User      `json:"teacher" gorm:"foreignKey:TeacherID"`    // 教师信息
	Students    []User    `json:"students" gorm:"many2many:class_users"`  // 学生列表
	Courses     []Course  `json:"courses" gorm:"many2many:class_courses"` // 课程列表
	IsActive    bool      `json:"is_active" gorm:"default:true"`          // 是否激活
}

