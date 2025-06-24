package dao

import (
	"time"

	"github.com/jun/fun_code/internal/model"
)

// CourseUpdateData 批量更新课程的数据结构
type CourseUpdateData struct {
	ExpectedUpdatedAt time.Time              `json:"expected_updated_at"` // 预期的更新时间（乐观锁）
	Updates           map[string]interface{} `json:"updates"`             // 要更新的字段
}

type CourseDao interface {
	// 基础CRUD操作
	CreateCourse(authorID uint, title, description, difficulty string, duration int, isPublished bool, thumbnailPath string) (*model.Course, error)
	UpdateCourse(courseID, authorID uint, expectedUpdatedAt time.Time, updates map[string]interface{}) error
	GetCourse(courseID uint) (*model.Course, error)
	GetCourseWithLessons(courseID uint) (*model.Course, error)
	ListCourses(authorID uint) ([]model.Course, error)
	DeleteCourse(courseID, authorID uint, expectedUpdatedAt time.Time) error

	// 分页查询
	ListCoursesWithPagination(authorID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Course, bool, error)

	// 发布管理
	PublishCourse(courseID, authorID uint, expectedUpdatedAt time.Time, isPublished bool) error

	// 排序功能
	ReorderCourses(authorID uint, courseIDs []uint) error

	// 统计功能
	CountCoursesByAuthor(authorID uint) (int64, error)
	GetCourseStats(courseID uint) (*CourseStats, error)

	// 课时管理
	AddLessonToCourse(courseID, authorID uint, lesson *model.Lesson) error
	RemoveLessonFromCourse(courseID, lessonID, authorID uint, expectedUpdatedAt time.Time) error

	// 批量操作
	BatchUpdateCourses(courseUpdates map[uint]CourseUpdateData) error
	BatchPublishCourses(authorID uint, courseIDs []uint, isPublished bool) error

	// 复制功能
	DuplicateCourse(courseID, authorID uint) (*model.Course, error)

	// 搜索功能
	SearchCourses(keyword string, authorID uint) ([]model.Course, error)
}

// CourseStats 课程统计信息
type CourseStats struct {
	LessonCount      int64 `json:"lesson_count"`      // 课时数量
	PublishedLessons int64 `json:"published_lessons"` // 已发布课时数量
	TotalDuration    int   `json:"total_duration"`    // 总时长（分钟）
	ClassCount       int64 `json:"class_count"`       // 关联班级数量
	StudentCount     int64 `json:"student_count"`     // 学习学生数量
}
