package dao

import (
	"errors"
	"strings"

	"github.com/jun/fun_code/internal/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserDaoImpl struct {
	db *gorm.DB
}

func NewUserDao(db *gorm.DB) UserDao {
	return &UserDaoImpl{
		db: db,
	}
}

// GetUserByID 根据ID获取用户信息
func (s *UserDaoImpl) GetUserByID(id uint) (*model.User, error) {
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户不存在")
		}
		return nil, err
	}
	return &user, nil
}

// GetUserByUsername 根据用户名获取用户信息
func (s *UserDaoImpl) GetUserByUsername(username string) (*model.User, error) {
	var user model.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户不存在")
		}
		return nil, err
	}
	return &user, nil
}

// GetUserByEmail 根据邮箱获取用户信息
func (s *UserDaoImpl) GetUserByEmail(email string) (*model.User, error) {
	var user model.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户不存在")
		}
		return nil, err
	}
	return &user, nil
}

// ListUsers 获取用户列表，支持分页
func (s *UserDaoImpl) ListUsers(page, pageSize int) ([]model.User, int64, error) {
	var users []model.User
	var total int64

	// 获取总数
	if err := s.db.Model(&model.User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (page - 1) * pageSize
	if err := s.db.Offset(offset).Limit(pageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// UpdateUser 更新用户信息
func (s *UserDaoImpl) UpdateUser(id uint, updates map[string]interface{}) error {
	// 检查用户是否存在
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("用户不存在")
		}
		return err
	}

	// 如果更新包含密码，需要加密
	if password, ok := updates["password"].(string); ok {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return errors.New("密码加密失败")
		}
		updates["password"] = string(hashedPassword)
	}

	// 如果更新包含用户名，需要检查唯一性
	if username, ok := updates["username"].(string); ok && username != user.Username {
		var existingUser model.User
		if err := s.db.Where("username = ?", username).First(&existingUser).Error; err == nil {
			return errors.New("用户名已被使用")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
	}

	// 如果更新包含邮箱，需要检查唯一性
	if email, ok := updates["email"].(string); ok && email != user.Email {
		var existingUser model.User
		if err := s.db.Where("email = ?", email).First(&existingUser).Error; err == nil {
			return errors.New("邮箱已被使用")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
	}

	// 执行更新
	if err := s.db.Model(&user).Updates(updates).Error; err != nil {
		return errors.New("更新用户失败")
	}

	return nil
}

// UpdateUserProfile 更新用户资料（不包括密码）
func (s *UserDaoImpl) UpdateUserProfile(id uint, nickname, email string) error {
	updates := map[string]interface{}{
		"nickname": nickname,
	}

	// 如果邮箱有变化，需要检查唯一性
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("用户不存在")
		}
		return err
	}

	if email != user.Email {
		var existingUser model.User
		if err := s.db.Where("email = ?", email).First(&existingUser).Error; err == nil {
			return errors.New("邮箱已被使用")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		updates["email"] = email
	}

	// 执行更新
	if err := s.db.Model(&user).Updates(updates).Error; err != nil {
		return errors.New("更新用户资料失败")
	}

	return nil
}

// ChangePassword 修改用户密码
func (s *UserDaoImpl) ChangePassword(id uint, oldPassword, newPassword string) error {
	// 检查用户是否存在
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("用户不存在")
		}
		return err
	}

	// 验证旧密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
		return errors.New("旧密码不正确")
	}

	// 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("密码加密失败")
	}

	// 更新密码
	if err := s.db.Model(&user).Update("password", string(hashedPassword)).Error; err != nil {
		return errors.New("更新密码失败")
	}

	return nil
}

// DeleteUser 删除用户
func (s *UserDaoImpl) DeleteUser(id uint) error {
	// 检查用户是否存在
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("用户不存在")
		}
		return err
	}

	// 执行软删除
	if err := s.db.Delete(&user).Error; err != nil {
		return errors.New("删除用户失败")
	}

	return nil
}

// HardDeleteUser 硬删除用户（慎用）
func (s *UserDaoImpl) HardDeleteUser(id uint) error {
	// 检查用户是否存在
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("用户不存在")
		}
		return err
	}

	// 执行硬删除
	if err := s.db.Unscoped().Delete(&user).Error; err != nil {
		return errors.New("删除用户失败")
	}

	return nil
}

// 创建用户
func (s *UserDaoImpl) CreateUser(user *model.User) error {
	// 检查用户名是否已存在
	var existingUser model.User
	if err := s.db.Where("username = ?", user.Username).First(&existingUser).Error; err == nil {
		return errors.New("用户名已被注册")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// 检查邮箱是否已被使用
	if err := s.db.Where("email = ?", user.Email).First(&existingUser).Error; err == nil {
		return errors.New("邮箱已被注册")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// 检查密码是否为空
	if user.Password == "" {
		return errors.New("密码不能为空")
	}

	// 如果密码未加密，则进行加密
	if len(user.Password) > 0 && !strings.HasPrefix(user.Password, "$2a$") {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
		if err != nil {
			return errors.New("密码加密失败")
		}
		user.Password = string(hashedPassword)
	}

	// 如果未指定角色，设置默认角色为学生
	if user.Role == "" {
		user.Role = "student"
	}

	// 创建用户
	if err := s.db.Create(user).Error; err != nil {
		return errors.New("创建用户失败: " + err.Error())
	}

	return nil
}
