package dao

import (
	"net/http"

	"github.com/jun/fun_code/internal/i18n"
	"github.com/jun/fun_code/internal/model"
)

type Dao struct {
	AuthDao    AuthDao
	UserDao    UserDao
	FileDao    FileDao
	ClassDao   ClassDao
	CourseDao  CourseDao
	ScratchDao ScratchDao
	I18nDao    i18n.I18nService // 新增 I18nService
}

type AuthDao interface {
	Register(username, password, email string) error
	Login(username, password string) (string, *http.Cookie, error)
	Logout(token string) (*http.Cookie, error)
	ValidateToken(tokenString string) (*Claims, error)
	GenerateCookie(token string) *http.Cookie
}

// UserDao 用户服务接口
type UserDao interface {
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
