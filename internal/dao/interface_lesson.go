package dao

import (
	"github.com/jun/fun_code/internal/model"
)

// LessonUpdateData 批量更新课时的数据结构
type LessonUpdateData struct {
	ExpectedUpdatedAt int64                  `json:"expected_updated_at"` // 预期的更新时间（乐观锁）
	Updates           map[string]interface{} `json:"updates"`             // 要更新的字段
}

// LessonOrder 课件排序项
type LessonOrder struct {
	ID        uint `json:"id" binding:"required"`
	SortOrder uint `json:"sort_order" binding:"required"`
}

// LessonDao 定义了课时服务的接口
type LessonDao interface {
	// CreateLesson 创建课时
	CreateLesson(lesson *model.Lesson) error

	// UpdateLesson 更新课时信息（乐观锁，基于updated_at避免并发更新）
	UpdateLesson(lessonID, authorID uint, expectedUpdatedAt int64, updates map[string]interface{}) error

	// GetLesson 获取课时详情
	GetLesson(lessonID uint) (*model.Lesson, error)

	// GetLessonWithPermission 获取课时详情（权限验证）
	GetLessonWithPermission(lessonID, userID uint) (*model.Lesson, error)

	// ListLessonsByCourse 获取课程下的所有课时（按排序）
	ListLessonsByCourse(courseID uint) ([]model.Lesson, error)

	// ListLessonsWithPagination 分页获取课时列表（可按课程筛选）
	ListLessonsWithPagination(courseID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Lesson, bool, error)

	// DeleteLesson 删除课时（乐观锁，基于updated_at避免并发删除）
	DeleteLesson(lessonID, authorID uint, expectedUpdatedAt int64) error

	// ReorderLessons 重新排序课时在特定课程中的顺序
	ReorderLessons(courseID uint, lessonIDs []uint) error

	// ReorderLessonsWithOrder 使用明确排序信息重新排序课时
	ReorderLessonsWithOrder(courseID uint, lessons []LessonOrder) error

	// GetLessonsByProjectID 根据项目ID获取相关课时
	GetLessonsByProjectID(projectID uint) ([]model.Lesson, error)

	// CountLessonsByCourse 统计课程下的课时数量
	CountLessonsByCourse(courseID uint) (int64, error)

	// GetNextLesson 获取下一课时
	GetNextLesson(courseID uint, currentSortOrder int) (*model.Lesson, error)

	// GetPreviousLesson 获取上一课时
	GetPreviousLesson(courseID uint, currentSortOrder int) (*model.Lesson, error)

	// SearchLessons 搜索课时
	SearchLessons(keyword string, courseID uint) ([]model.Lesson, error)

	// BatchUpdateLessons 批量更新课时（乐观锁，基于updated_at避免并发更新）
	BatchUpdateLessons(lessonUpdates map[uint]LessonUpdateData) error

	// DuplicateLesson 复制课时到目标课程
	DuplicateLesson(lessonID, targetCourseID, authorID uint) (*model.Lesson, error)

	// === 新增：课时-课程关联管理 ===

	// AddLessonToCourse 将课时添加到课程
	AddLessonToCourse(lessonID, courseID uint, sortOrder int) error

	// RemoveLessonFromCourse 从课程中移除课时
	RemoveLessonFromCourse(lessonID, courseID uint) error

	// GetLessonCourses 获取课时关联的所有课程
	GetLessonCourses(lessonID uint) ([]model.Course, error)

	// UpdateLessonInCourse 更新课时在特定课程中的信息（排序等）
	UpdateLessonInCourse(lessonID, courseID uint, sortOrder int) error
}
