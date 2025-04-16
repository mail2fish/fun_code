package service

import (
	"io"
	"net/http"

	"github.com/jun/fun_code/internal/model"
)

type Services struct {
	UserService    UserService
	FileService    FileService
	ClassService   ClassService
	CourseService  CourseService
	ScratchService ScratchService
}

// 在 UserService 接口中添加新方法
type UserService interface {
	Register(username, password, email string) error
	// 修改 Login 方法的返回值，增加 *http.Cookie
	Login(username, password string) (string, *http.Cookie, error)
	Logout(token string) (*http.Cookie, error)
	ValidateToken(tokenString string) (*Claims, error)
	GenerateCookie(token string) *http.Cookie
}

type FileService interface {
	CreateDirectory(userID uint, name string, parentID *uint) error
	UploadFile(userID uint, name string, parentID *uint, contentType string, size int64, reader io.Reader) error
	GetFile(userID, fileID uint) (*model.File, error)
	ListFiles(userID uint, parentID *uint) ([]model.File, error)
	DeleteFile(userID, fileID uint) error
}

// ClassService 班级服务接口
type ClassService interface {
	// 班级管理
	CreateClass(teacherID uint, name, description string, startDate, endDate string) (*model.Class, error)
	UpdateClass(classID, teacherID uint, updates map[string]interface{}) error
	GetClass(classID uint) (*model.Class, error)
	ListClasses(teacherID uint) ([]model.Class, error)
	DeleteClass(classID, teacherID uint) error

	// 学生管理
	AddStudent(classID, teacherID, studentID uint, role string) error
	RemoveStudent(classID, teacherID, studentID uint) error
	ListStudents(classID, teacherID uint) ([]model.User, error)

	// 课程管理
	AddCourse(classID, teacherID, courseID uint, startDate, endDate string) error
	RemoveCourse(classID, teacherID, courseID uint) error
	ListCourses(classID, teacherID uint) ([]model.Course, error)

	// 学生视角
	JoinClass(studentID uint, classCode string) error
	ListJoinedClasses(studentID uint) ([]model.Class, error)
}

// CourseService 课程服务接口
type CourseService interface {
	CreateCourse(authorID uint, title, description, content string, isPublic bool) (*model.Course, error)
	UpdateCourse(courseID, authorID uint, updates map[string]interface{}) error
	GetCourse(courseID uint) (*model.Course, error)
	ListCourses(authorID uint) ([]model.Course, error)
	DeleteCourse(courseID, authorID uint) error
}
