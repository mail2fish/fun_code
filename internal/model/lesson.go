package model

import (
	"time"

	"gorm.io/gorm"
)

// Lesson 课时模型
type Lesson struct {
	ID        uint   `json:"id" gorm:"primarykey;autoIncrement"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
	DeletedAt *int64 `json:"deleted_at,omitempty" gorm:"index"`

	// 基本信息
	Title   string `json:"title" gorm:"size:200;not null"` // 课时标题
	Content string `json:"content" gorm:"type:text"`       // 课时内容

	// 关联关系 - 多对多关系
	Courses []Course `json:"courses,omitempty" gorm:"many2many:lesson_courses"` // 关联的课程列表

	// 文档相关字段
	DocumentName string `json:"document_name" gorm:"size:255"` // 文档名称
	DocumentPath string `json:"document_path" gorm:"size:500"` // 文档路径

	// 流程图字段
	FlowChartID uint `json:"flow_chart_id" gorm:"index"` // 流程图ID

	// 项目相关字段
	ProjectType string `json:"project_type" gorm:"size:50"` // 项目类型
	ProjectID1  uint   `json:"project_id_1" gorm:"index"`   // 项目ID 1
	ProjectID2  uint   `json:"project_id_2" gorm:"index"`   // 项目ID 2
	ProjectID3  uint   `json:"project_id_3" gorm:"index"`   // 项目ID 3

	// 视频相关字段
	Video1 string `json:"video_1" gorm:"size:500"` // 视频1路径/URL
	Video2 string `json:"video_2" gorm:"size:500"` // 视频2路径/URL
	Video3 string `json:"video_3" gorm:"size:500"` // 视频3路径/URL

	// 其他字段
	Duration    int    `json:"duration" gorm:"default:0"`    // 课时时长（分钟）
	Difficulty  string `json:"difficulty" gorm:"size:20"`    // 难度级别
	Description string `json:"description" gorm:"size:1000"` // 课时描述
}

func (l *Lesson) TableName() string {
	return "lessons"
}

// BeforeCreate GORM钩子，在创建前设置时间戳
func (l *Lesson) BeforeCreate(tx *gorm.DB) error {
	now := time.Now().Unix()
	l.CreatedAt = now
	l.UpdatedAt = now
	return nil
}

// BeforeUpdate GORM钩子，在更新前设置时间戳
func (l *Lesson) BeforeUpdate(tx *gorm.DB) error {
	l.UpdatedAt = time.Now().Unix()
	return nil
}
