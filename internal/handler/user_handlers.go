package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"gorm.io/gorm"
)

// CreateUserParams 创建用户请求参数
type CreateUserParams struct {
	Username string `json:"username" binding:"required"`
	Nickname string `json:"nickname"`
	Password string `json:"password" binding:"required"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

func (p *CreateUserParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60001, "无效的请求参数", err)
	}
	return nil
}

// CreateUserResponse 创建用户响应
type CreateUserResponse struct {
	Message string `json:"message"`
	Data    struct {
		ID       uint   `json:"id"`
		Username string `json:"username"`
		Nickname string `json:"nickname"`
		Email    string `json:"email"`
		Role     string `json:"role"`
	} `json:"data"`
}

// CreateUserHandler 创建用户 gorails.Wrap 形式
func (h *Handler) CreateUserHandler(c *gin.Context, params *CreateUserParams) (*CreateUserResponse, *gorails.ResponseMeta, gorails.Error) {
	// 构造用户模型
	user := &model.User{
		Username: params.Username,
		Nickname: params.Nickname,
		Password: params.Password,
		Email:    params.Email,
		Role:     params.Role,
	}

	// 如果 Nickname 为空，则使用 Username 作为 Nickname
	if user.Nickname == "" {
		user.Nickname = user.Username
	}

	// 调用服务层创建用户
	err := h.dao.UserDao.CreateUser(user)
	if err != nil {
		// 判断是否为自定义错误
		if ce, ok := err.(*custom_error.CustomError); ok {
			lang := h.i18n.GetDefaultLanguage()
			if l := c.GetHeader("Accept-Language"); l != "" {
				lang = l
			}
			msg := h.i18n.Translate(ce.Message, lang)
			return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), int(ce.Code), msg, err)
		}
		// 其他未知错误
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		msg := h.i18n.Translate("user.create_failed", lang)
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60002, msg, err)
	}

	// 返回成功响应
	lang := h.i18n.GetDefaultLanguage()
	if l := c.GetHeader("Accept-Language"); l != "" {
		lang = l
	}

	response := &CreateUserResponse{
		Message: h.i18n.Translate("user.create_success", lang),
	}
	response.Data.ID = user.ID
	response.Data.Username = user.Username
	response.Data.Nickname = user.Nickname
	response.Data.Email = user.Email
	response.Data.Role = user.Role

	return response, nil, nil
}

// ListUsersParams 列出用户请求参数
type ListUsersParams struct {
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
}

func (p *ListUsersParams) Parse(c *gin.Context) gorails.Error {
	// 设置默认值
	p.PageSize = 20
	p.BeginID = 0
	p.Forward = true
	p.Asc = true

	// 解析页面大小
	if pageSizeStr := c.DefaultQuery("pageSize", "20"); pageSizeStr != "" {
		if pageSize, err := strconv.ParseUint(pageSizeStr, 10, 32); err == nil {
			if pageSize > 0 && pageSize <= 100 {
				p.PageSize = uint(pageSize)
			}
		}
	}

	// 解析起始ID
	if beginIDStr := c.DefaultQuery("beginID", "0"); beginIDStr != "" {
		if beginID, err := strconv.ParseUint(beginIDStr, 10, 32); err == nil {
			p.BeginID = uint(beginID)
		}
	}

	// 解析翻页方向
	if forwardStr := c.DefaultQuery("forward", "true"); forwardStr != "" {
		p.Forward = forwardStr != "false"
	}

	// 解析排序方向
	if ascStr := c.DefaultQuery("asc", "true"); ascStr != "" {
		p.Asc = ascStr != "false"
	}

	return nil
}

type UserResponse struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	Username  string         `gorm:"uniqueIndex;size:50" json:"username"`
	Nickname  string         `gorm:"size:50" json:"nickname"`
	Email     string         `gorm:"size:100" json:"email"`
	Role      string         `gorm:"size:20;default:'student'" json:"role"` // 用户角色: admin, teacher, student
}

// ListUsersHandler 列出用户 gorails.Wrap 形式
func (h *Handler) ListUsersHandler(c *gin.Context, params *ListUsersParams) ([]UserResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取用户总数
	total, err := h.dao.UserDao.CountUsers()
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60003, "获取用户总数失败", err)
	}

	// 获取用户列表
	users, hasMore, err := h.dao.UserDao.ListUsers(params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		msg := h.i18n.Translate("user.list_failed", lang)
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60004, msg, err)
	}

	userResponses := make([]UserResponse, len(users))
	for i, user := range users {
		nickname := user.Nickname
		if nickname == "" {
			nickname = user.Username
		}
		userResponses[i] = UserResponse{
			ID:        user.ID,
			CreatedAt: user.CreatedAt,
			UpdatedAt: user.UpdatedAt,
			DeletedAt: user.DeletedAt,
			Username:  user.Username,
			Nickname:  nickname,
			Email:     user.Email,
			Role:      user.Role,
		}
	}
	return userResponses, &gorails.ResponseMeta{
		Total:   int(total),
		HasNext: hasMore,
	}, nil
}

// UpdateUserParams 更新用户请求参数
type UpdateUserParams struct {
	UserID   uint   `json:"user_id" uri:"user_id" binding:"required"`
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

func (p *UpdateUserParams) Parse(c *gin.Context) gorails.Error {
	// 先解析路径参数
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60005, "无效的用户ID", err)
	}
	// 再解析JSON参数
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60006, "无效的请求参数", err)
	}
	return nil
}

// UpdateUserResponse 更新用户响应
type UpdateUserResponse struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

// UpdateUserHandler 更新用户 gorails.Wrap 形式
func (h *Handler) UpdateUserHandler(c *gin.Context, params *UpdateUserParams) (*UpdateUserResponse, *gorails.ResponseMeta, gorails.Error) {
	// 构建更新参数
	updates := make(map[string]interface{})
	if params.Username != "" {
		updates["username"] = params.Username
	}
	if params.Nickname != "" {
		updates["nickname"] = params.Nickname
	}
	if params.Email != "" {
		updates["email"] = params.Email
	}
	if params.Role != "" {
		updates["role"] = params.Role
	}

	// 调用服务层更新用户
	err := h.dao.UserDao.UpdateUser(params.UserID, updates)
	if err != nil {
		// 判断是否为自定义错误
		if ce, ok := err.(*custom_error.CustomError); ok {
			lang := h.i18n.GetDefaultLanguage()
			if l := c.GetHeader("Accept-Language"); l != "" {
				lang = l
			}
			msg := h.i18n.Translate(ce.Message, lang)
			return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), int(ce.Code), msg, err)
		}
		// 其他未知错误
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		msg := h.i18n.Translate("user.update_failed", lang)
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60007, msg, err)
	}

	// 获取更新后的用户信息
	user, err := h.dao.UserDao.GetUserByID(params.UserID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60008, "获取更新后的用户信息失败", err)
	}

	response := &UpdateUserResponse{}
	response.ID = user.ID
	response.Username = user.Username
	response.Nickname = user.Nickname
	response.Email = user.Email
	response.Role = user.Role

	return response, nil, nil
}

// GetUserParams 获取用户信息请求参数
type GetUserParams struct {
	UserID uint `json:"user_id" uri:"user_id" binding:"required"`
}

func (p *GetUserParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60009, "无效的用户ID", err)
	}
	return nil
}

// GetUserResponse 获取用户信息响应
type GetUserResponse struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

// GetUserHandler 获取用户信息 gorails.Wrap 形式
func (h *Handler) GetUserHandler(c *gin.Context, params *GetUserParams) (*GetUserResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取用户信息
	user, err := h.dao.UserDao.GetUserByID(params.UserID)
	if err != nil {
		// 判断是否为自定义错误
		if ce, ok := err.(*custom_error.CustomError); ok {
			lang := h.i18n.GetDefaultLanguage()
			if l := c.GetHeader("Accept-Language"); l != "" {
				lang = l
			}
			msg := h.i18n.Translate(ce.Message, lang)
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), int(ce.Code), msg, err)
		}
		// 其他未知错误
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60010, "获取用户信息失败", err)
	}

	response := &GetUserResponse{}
	response.ID = user.ID
	response.Username = user.Username
	response.Nickname = user.Nickname
	response.Email = user.Email
	response.Role = user.Role

	return response, nil, nil
}

// SearchUsersParams 搜索用户请求参数
type SearchUsersParams struct {
	Keyword string `json:"keyword" form:"keyword"`
}

func (p *SearchUsersParams) Parse(c *gin.Context) gorails.Error {
	// 解析关键词
	p.Keyword = c.DefaultQuery("keyword", "")
	if p.Keyword == "" {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60012, "无效的搜索关键词", nil)
	}
	return nil
}

// SearchUsersHandler 搜索用户 gorails.Wrap 形式
func (h *Handler) SearchUsersHandler(c *gin.Context, params *SearchUsersParams) ([]UserResponse, *gorails.ResponseMeta, gorails.Error) {
	// 搜索用户
	users, err := h.dao.UserDao.SearchUsers(params.Keyword)
	if err != nil {
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		msg := h.i18n.Translate("user.search_failed", lang)
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60011, msg, err)
	}

	userResponses := make([]UserResponse, len(users))
	for i, user := range users {
		nickname := user.Nickname
		if nickname == "" {
			nickname = user.Username
		}
		userResponses[i] = UserResponse{
			ID:        user.ID,
			CreatedAt: user.CreatedAt,
			UpdatedAt: user.UpdatedAt,
			DeletedAt: user.DeletedAt,
			Username:  user.Username,
			Nickname:  nickname,
			Email:     user.Email,
			Role:      user.Role,
		}
	}
	return userResponses, nil, nil
}

// SetUserRole 设置用户角色
func (h *Handler) SetUserRole(c *gin.Context) {
	// 只有管理员可以设置用户角色
	if !h.hasPermission(c, PermissionManageAll) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "只有管理员可以设置用户角色",
		})
		return
	}

	var req struct {
		UserID uint   `json:"user_id" binding:"required"`
		Role   string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 验证角色是否有效
	if req.Role != RoleAdmin && req.Role != RoleTeacher && req.Role != RoleStudent {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的角色",
		})
		return
	}

	// 更新用户角色
	updates := map[string]interface{}{
		"role": req.Role,
	}

	if err := h.dao.UserDao.UpdateUser(req.UserID, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "设置用户角色失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "用户角色设置成功",
	})
}

// GetCurrentUserPermissions 获取当前用户的权限
func (h *Handler) GetCurrentUserPermissions(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}

	// 获取用户信息
	user, err := h.dao.UserDao.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取用户信息失败: " + err.Error(),
		})
		return
	}

	// 获取用户角色对应的权限
	permissions, exists := rolePermissions[user.Role]
	if !exists {
		permissions = []string{}
	}

	c.JSON(http.StatusOK, gin.H{
		"role":        user.Role,
		"permissions": permissions,
	})
}
