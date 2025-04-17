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



// CourseService 课程服务接口
