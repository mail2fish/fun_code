package dao

import "github.com/jun/fun_code/internal/model"

type CourseDao interface {
	CreateCourse(authorID uint, title, description, content string, isPublic bool) (*model.Course, error)
	UpdateCourse(courseID, authorID uint, updates map[string]interface{}) error
	GetCourse(courseID uint) (*model.Course, error)
	ListCourses(authorID uint) ([]model.Course, error)
	DeleteCourse(courseID, authorID uint) error
}
