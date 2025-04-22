package dao

import "github.com/jun/fun_code/internal/model"

// UserDao 用户服务接口
type UserDao interface {
	CreateUser(user *model.User) error
	GetUserByID(id uint) (*model.User, error)
	GetUserByUsername(username string) (*model.User, error)
	GetUserByEmail(email string) (*model.User, error)
	ListUsers(pageSize uint, beginID uint, forward, asc bool) ([]model.User, bool, error)
	UpdateUser(id uint, updates map[string]interface{}) error
	UpdateUserProfile(id uint, nickname, email string) error
	ChangePassword(id uint, oldPassword, newPassword string) error
	DeleteUser(id uint) error
	HardDeleteUser(id uint) error
	CountUsers() (int64, error)
}
