package dao

import (
	"net/http"

	"github.com/jun/fun_code/internal/i18n"
	"github.com/jun/fun_code/internal/model"
)

type Services struct {
	AuthService    AuthService
	UserService    UserService
	FileService    FileService
	ClassService   ClassService
	CourseService  CourseService
	ScratchService ScratchService
	I18nService    i18n.I18nService // 新增 I18nService
}

type AuthService interface {
	Register(username, password, email string) error
	Login(username, password string) (string, *http.Cookie, error)
	Logout(token string) (*http.Cookie, error)
	ValidateToken(tokenString string) (*Claims, error)
	GenerateCookie(token string) *http.Cookie
}

// UserService 用户服务接口
type UserService interface {
	GetUserByID(id uint) (*model.User, error)
	GetUserByUsername(username string) (*model.User, error)
	GetUserByEmail(email string) (*model.User, error)
	ListUsers(page, pageSize int) ([]model.User, int64, error)
	UpdateUser(id uint, updates map[string]interface{}) error
	UpdateUserProfile(id uint, nickname, email string) error
	ChangePassword(id uint, oldPassword, newPassword string) error
	DeleteUser(id uint) error
	HardDeleteUser(id uint) error
}
