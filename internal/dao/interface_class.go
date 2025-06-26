package dao

import "github.com/jun/fun_code/internal/model"

// ClassDao 定义了班级服务的接口
type ClassDao interface {
	// CreateClass 创建班级
	CreateClass(teacherID uint, name, description string, startDateStr, endDateStr string) (*model.Class, error)

	// UpdateClass 更新班级信息
	UpdateClass(classID, teacherID uint, updates map[string]interface{}) error

	// GetClass 获取班级详情
	GetClass(classID uint) (*model.Class, error)

	// ListClasses 列出教师创建的所有班级
	ListClasses(teacherID uint) ([]model.Class, error)

	// ListClassesWithPagination 分页列出教师的所有班级
	ListClassesWithPagination(userID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Class, bool, error)

	// DeleteClass 删除班级
	DeleteClass(classID, teacherID uint) error

	// AddStudent 添加学生到班级
	AddStudent(classID, teacherID, studentID uint, role string) error

	// RemoveStudent 从班级移除学生
	RemoveStudent(classID, teacherID, studentID uint) error

	// ListStudents 列出班级中的所有学生
	ListStudents(classID, teacherID uint) ([]model.User, error)

	// AddCourse 添加课程到班级
	AddCourse(classID, teacherID, courseID uint, startDateStr, endDateStr string) error

	// RemoveCourse 从班级移除课程
	RemoveCourse(classID, teacherID, courseID uint) error

	// ListCourses 列出班级中的所有课程（管理员用，需要权限检查）
	ListCourses(classID, teacherID uint) ([]model.Course, error)

	// ListCoursesByClass 列出班级中的所有课程（学生端用，不需要权限检查）
	ListCoursesByClass(classID uint) ([]model.Course, error)

	// JoinClass 学生加入班级
	JoinClass(studentID uint, classCode string) error

	// ListJoinedClasses 列出学生加入的所有班级
	ListJoinedClasses(studentID uint) ([]model.Class, error)

	// CountClasses 统计教师创建的班级数量
	CountClasses(teacherID uint) (int64, error)

	// GetUserClasses 获取用户参与的所有班级（包括作为教师和学生的班级）
	GetUserClasses(userID uint) ([]model.Class, error)

	// IsLessonInClass 检查课时是否在班级中
	IsLessonInClass(classID, courseID, lessonID uint) (bool, error)
}
