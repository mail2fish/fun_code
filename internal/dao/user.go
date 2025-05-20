package dao

import (
	"errors"
	"strings"

	custom_error "github.com/jun/fun_code/internal/custom_error" // 导入自定义错误包
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
			// 使用 NewDaoError 报告业务错误（未找到）
			return nil, custom_error.NewDaoError(custom_error.USER, ErrorCodeQueryNotFound, "user.not_found", err)
		}
		// 使用 NewThirdPartyError 包装数据库查询错误
		return nil, custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}
	return &user, nil
}

// GetUserByUsername 根据用户名获取用户信息
func (s *UserDaoImpl) GetUserByUsername(username string) (*model.User, error) {
	var user model.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, custom_error.NewDaoError(custom_error.USER, ErrorCodeQueryNotFound, "user.not_found", err)
		}
		return nil, custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}
	return &user, nil
}

// GetUserByEmail 根据邮箱获取用户信息
func (s *UserDaoImpl) GetUserByEmail(email string) (*model.User, error) {
	var user model.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, custom_error.NewDaoError(custom_error.USER, ErrorCodeQueryNotFound, "user.not_found", err)
		}
		return nil, custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}
	return &user, nil
}

// ListUsers 获取用户列表，支持分页
func (s *UserDaoImpl) ListUsers(pageSize uint, beginID uint, forward, asc bool) ([]model.User, bool, error) {
	var users []model.User

	// 处理 pageSize 为 0 的情况，使用默认值 20
	if pageSize == 0 {
		pageSize = 20
	}

	// 构建基础查询
	query := s.db

	// 记录查询是否按升序排序
	queryAsc := false

	// 根据 beginID、forward 和 asc 设置查询条件和排序
	if beginID > 0 {
		if asc && forward {
			// asc == true and forward == true
			// id >= beginID, order 为 id asc
			query = query.Where("id > ?", beginID).Order("id ASC")
			queryAsc = true
		} else if asc && !forward {
			// asc == true and forward == false
			// id <= beginID，order 为 id desc
			query = query.Where("id < ?", beginID).Order("id DESC")
			queryAsc = false
		} else if !asc && forward {
			// asc == false and forward == true
			// id <= beginID，order 为 id desc
			query = query.Where("id < ?", beginID).Order("id DESC")
			queryAsc = false
		} else {
			// asc == false and forward == false
			// id >= beginID, order 为 id asc
			query = query.Where("id > ?", beginID).Order("id ASC")
			queryAsc = true
		}
	} else {
		// beginID 为 0 的情况
		if asc {
			// asc 为 true，按 id asc 排序
			query = query.Order("id ASC")
			queryAsc = true
		} else {
			// asc 为 false，按 id desc 排序
			query = query.Order("id DESC")
			queryAsc = false
		}
	}

	// 执行查询，多查询一条用于判断是否有更多数据
	if err := query.Limit(int(pageSize + 1)).Find(&users).Error; err != nil {
		return nil, false, custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}

	// 处理查询结果
	// asc 为 true 时，返回结果数组按 id 升序排序，代表页面按升序显示
	// asc 为 false 时，返回结果数组按 id 降序排序，代表页面按降序显示
	hasMore := len(users) > int(pageSize)
	if hasMore {
		users = users[:pageSize]
	}

	// 检查查询结果的排序是否与 asc 参数一致，如果不一致则需要反转
	if queryAsc != asc {
		for i, j := 0, len(users)-1; i < j; i, j = i+1, j-1 {
			users[i], users[j] = users[j], users[i]
		}
	}

	return users, hasMore, nil
}

// UpdateUser 更新用户信息
func (s *UserDaoImpl) UpdateUser(id uint, updates map[string]interface{}) error {
	// 检查用户是否存在
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return custom_error.NewDaoError(custom_error.USER, ErrorCodeQueryNotFound, "user.not_found", err)
		}
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}

	// 如果更新包含密码，需要加密
	if password, ok := updates["password"].(string); ok && password != "" { // 增加非空判断
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			// 密码加密失败，使用 UpdateFailed 作为通用处理失败码
			return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeUpdateFailed, "user.password_encrypt_failed", err)
		}
		updates["password"] = string(hashedPassword)
	} else if ok {
		// 如果传入空密码，从更新中移除，避免将密码设置为空
		delete(updates, "password")
	}

	// 如果更新包含用户名，需要检查唯一性
	if username, ok := updates["username"].(string); ok && username != user.Username {
		var existingUser model.User
		// 检查是否存在其他用户使用该用户名
		err := s.db.Where("username = ? AND id <> ?", username, id).First(&existingUser).Error
		if err == nil {
			// 用户名已被使用，是业务错误，使用 UpdateFailed 码表示更新冲突
			return custom_error.NewDaoError(custom_error.USER, ErrorCodeUpdateFailed, "user.username_taken", err)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			// 其他数据库查询错误
			return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
		}
		// 如果 err 是 gorm.ErrRecordNotFound，则表示用户名可用，继续
	}

	// 如果更新包含邮箱，需要检查唯一性
	if email, ok := updates["email"].(string); ok && email != user.Email {
		var existingUser model.User
		// 检查是否存在其他用户使用该邮箱
		err := s.db.Where("email = ? AND id <> ?", email, id).First(&existingUser).Error
		if err == nil {
			// 邮箱已被使用，是业务错误，使用 UpdateFailed 码表示更新冲突
			return custom_error.NewDaoError(custom_error.USER, ErrorCodeUpdateFailed, "user.email_taken", err)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			// 其他数据库查询错误
			return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
		}
		// 如果 err 是 gorm.ErrRecordNotFound，则表示邮箱可用，继续
	}

	// 执行更新
	if err := s.db.Model(&user).Updates(updates).Error; err != nil {
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeUpdateFailed, "user.update_failed", err)
	}

	return nil
}

// UpdateUserProfile 更新用户资料（不包括密码）
func (s *UserDaoImpl) UpdateUserProfile(id uint, nickname, email string) error {
	// 检查用户是否存在
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return custom_error.NewDaoError(custom_error.USER, ErrorCodeQueryNotFound, "user.not_found", err)
		}
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}

	updates := map[string]interface{}{
		"nickname": nickname,
	}

	// 如果邮箱有变化，需要检查唯一性
	if email != user.Email {
		var existingUser model.User
		err := s.db.Where("email = ? AND id <> ?", email, id).First(&existingUser).Error
		if err == nil {
			// 邮箱已被使用，是业务错误，使用 UpdateFailed 码表示更新冲突
			return custom_error.NewDaoError(custom_error.USER, ErrorCodeUpdateFailed, "user.email_taken", err)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
		}
		updates["email"] = email // 只有在邮箱可用时才加入更新列表
	}

	// 执行更新
	if err := s.db.Model(&user).Updates(updates).Error; err != nil {
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeUpdateFailed, "user.update_profile_failed", err)
	}

	return nil
}

// ChangePassword 修改用户密码
func (s *UserDaoImpl) ChangePassword(id uint, oldPassword, newPassword string) error {
	// 检查用户是否存在
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return custom_error.NewDaoError(custom_error.USER, ErrorCodeQueryNotFound, "user.not_found", err)
		}
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}

	// 验证旧密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
		// 旧密码不正确，是业务错误，使用 UpdateFailed 码表示更新前验证失败
		return custom_error.NewDaoError(custom_error.USER, ErrorCodeUpdateFailed, "user.old_password_incorrect", err)
	}

	// 检查新密码是否为空
	if newPassword == "" {
		// 新密码不能为空，是业务错误，使用 UpdateFailed 码表示更新数据无效
		return custom_error.NewDaoError(custom_error.USER, ErrorCodeUpdateFailed, "user.password_empty", nil)
	}

	// 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		// 密码加密失败，使用 UpdateFailed 作为通用处理失败码
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeUpdateFailed, "user.password_encrypt_failed", err)
	}

	// 更新密码
	if err := s.db.Model(&user).Update("password", string(hashedPassword)).Error; err != nil {
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeUpdateFailed, "user.update_password_failed", err)
	}

	return nil
}

// DeleteUser 删除用户
func (s *UserDaoImpl) DeleteUser(id uint) error {
	// 检查用户是否存在 (软删除前也检查)
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return custom_error.NewDaoError(custom_error.USER, ErrorCodeQueryNotFound, "user.not_found", err)
		}
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}

	// 执行软删除
	if err := s.db.Delete(&user).Error; err != nil {
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeDeleteFailed, "user.delete_failed", err)
	}

	return nil
}

// HardDeleteUser 硬删除用户（慎用）
func (s *UserDaoImpl) HardDeleteUser(id uint) error {
	// 检查用户是否存在 (硬删除前也检查)
	var user model.User
	// 使用 Unscoped() 查找包括已软删除的用户，以防重复删除或删除不存在的用户
	if err := s.db.Unscoped().First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return custom_error.NewDaoError(custom_error.USER, ErrorCodeQueryNotFound, "user.not_found", err)
		}
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}

	// 执行硬删除
	if err := s.db.Unscoped().Delete(&user).Error; err != nil {
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeDeleteFailed, "user.delete_failed", err)
	}

	return nil
}

// CreateUser 创建用户
func (s *UserDaoImpl) CreateUser(user *model.User) error {
	// 检查用户名是否已存在
	var existingUser model.User
	err := s.db.Where("username = ?", user.Username).First(&existingUser).Error
	if err == nil {
		// 用户名已被注册，是业务错误，使用 InsertFailed 码表示插入冲突
		return custom_error.NewDaoError(custom_error.USER, ErrorCodeInsertFailed, "user.username_taken", err)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		// 其他数据库查询错误
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}
	// err 是 gorm.ErrRecordNotFound，表示用户名可用

	// 如果邮箱不为空，检查邮箱是否已被使用
	if user.Email != "" {
		// 检查邮箱是否已被使用
		err = s.db.Where("email = ?", user.Email).First(&existingUser).Error
		if err == nil {
			// 邮箱已被注册，是业务错误，使用 InsertFailed 码表示插入冲突
			return custom_error.NewDaoError(custom_error.USER, ErrorCodeInsertFailed, "user.email_taken", err)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			// 其他数据库查询错误
			return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
		}
		// err 是 gorm.ErrRecordNotFound，表示邮箱可用
	}

	// 检查密码是否为空
	if user.Password == "" {
		// 密码不能为空，是业务错误，使用 InsertFailed 码表示插入数据无效
		return custom_error.NewDaoError(custom_error.USER, ErrorCodeInsertFailed, "user.password_empty", nil)
	}

	// 如果密码未加密，则进行加密
	if len(user.Password) > 0 && !strings.HasPrefix(user.Password, "$2a$") { // 简单检查是否已加密
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
		if err != nil {
			// 密码加密失败，使用 InsertFailed 作为通用处理失败码
			return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeInsertFailed, "user.password_encrypt_failed", err)
		}
		user.Password = string(hashedPassword)
	}

	// 如果未指定角色，设置默认角色为学生
	if user.Role == "" {
		user.Role = "student" // 考虑使用 model.RoleStudent 常量
	}

	// 创建用户
	if err := s.db.Create(user).Error; err != nil {
		// 数据库创建失败
		return custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeInsertFailed, "user.create_failed", err)
	}

	return nil
}

// CountUsers 获取用户总数
func (s *UserDaoImpl) CountUsers() (int64, error) {
	var count int64
	if err := s.db.Model(&model.User{}).Count(&count).Error; err != nil {
		return 0, custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}
	return count, nil
}

// GetUsersByIDs 获取用户列表
func (s *UserDaoImpl) GetUsersByIDs(ids []uint) ([]model.User, error) {
	var users []model.User
	if err := s.db.Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}
	return users, nil
}

// SearchUsers 搜索用户
func (s *UserDaoImpl) SearchUsers(keyword string) ([]model.User, error) {
	var users []model.User
	if err := s.db.Where("username LIKE ? OR email LIKE ? OR nickname LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%").Find(&users).Error; err != nil {
		return nil, custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeQueryFailed, "user.db_query_failed", err)
	}
	return users, nil
}
