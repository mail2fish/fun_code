package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
	"github.com/mail2fish/gorails/gorails"
)

// RegisterParams 注册请求参数
type RegisterParams struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
}

func (p *RegisterParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.AUTH), 40001, "参数无效", err)
	}
	return nil
}

// RegisterResponse 注册响应
type RegisterResponse struct {
	Message string `json:"message"`
}

// RegisterHandler 用户注册 gorails.Wrap 形式
func (h *Handler) RegisterHandler(c *gin.Context, params *RegisterParams) (*RegisterResponse, *gorails.ResponseMeta, gorails.Error) {
	if err := h.dao.AuthDao.Register(params.Username, params.Password, params.Email); err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.AUTH), 40002, err.Error(), err)
	}

	return &RegisterResponse{Message: "注册成功"}, nil, nil
}

// LoginParams 登录请求参数
type LoginParams struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (p *LoginParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.AUTH), 40003, "参数无效", err)
	}
	return nil
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token string `json:"token"`
	Role  string `json:"role"`
}

// LoginHandler 用户登录 gorails.Wrap 形式
func (h *Handler) LoginHandler(c *gin.Context, params *LoginParams) (*LoginResponse, *gorails.ResponseMeta, gorails.Error) {
	loginResponse, err := h.dao.AuthDao.Login(params.Username, params.Password)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.AUTH), 40004, err.Error(), err)
	}

	// 设置 cookie
	c.SetCookie(
		loginResponse.Cookie.Name,
		loginResponse.Cookie.Value,
		loginResponse.Cookie.MaxAge,
		loginResponse.Cookie.Path,
		loginResponse.Cookie.Domain,
		loginResponse.Cookie.Secure,
		loginResponse.Cookie.HttpOnly,
	)

	return &LoginResponse{Token: loginResponse.Token, Role: loginResponse.Role}, nil, nil
}

// LogoutParams 登出请求参数
type LogoutParams struct {
	// 无需额外参数，token从请求中获取
}

func (p *LogoutParams) Parse(c *gin.Context) gorails.Error {
	// 无需解析参数
	return nil
}

// LogoutResponse 登出响应
type LogoutResponse struct {
	Message string `json:"message"`
}

// LogoutHandler 用户登出 gorails.Wrap 形式
func (h *Handler) LogoutHandler(c *gin.Context, params *LogoutParams) (*LogoutResponse, *gorails.ResponseMeta, gorails.Error) {
	token := getToken(c)
	if token == "" {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.AUTH), 40005, "未提供认证token", nil)
	}

	// 调用服务层登出方法
	expiredCookie, err := h.dao.AuthDao.Logout(token)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.AUTH), 40006, err.Error(), err)
	}

	// 设置过期的 cookie
	c.SetCookie(
		expiredCookie.Name,
		expiredCookie.Value,
		expiredCookie.MaxAge,
		expiredCookie.Path,
		expiredCookie.Domain,
		expiredCookie.Secure,
		expiredCookie.HttpOnly,
	)

	return &LogoutResponse{Message: "登出成功"}, nil, nil
}

// AuthMiddleware 认证中间件, 用于验证用户身份
func (h *Handler) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := getToken(c)
		if token == "" {
			// 重定向到首页
			c.Redirect(http.StatusFound, "/")
			c.Abort()
			return
		}

		claims, err := h.dao.AuthDao.ValidateToken(token)
		if err != nil {
			// 重定向到首页
			c.Redirect(http.StatusFound, "/")
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Next()
	}
}

func getToken(c *gin.Context) string {
	// 优先从Header获取token
	token := c.GetHeader("Authorization")

	// 如果Header中没有，尝试从cookie获取
	if token == "" {
		if cookie, err := c.Cookie("auth_token"); err == nil {
			token = "Bearer " + cookie
		}
	}

	// 去掉Bearer前缀
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}
	return token
}

// 保留原有的旧handler以保持兼容性（可以逐步迁移）
func (h *Handler) Register(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数无效"})
		return
	}

	if err := h.dao.AuthDao.Register(req.Username, req.Password, req.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "注册成功"})
}

// Logout 处理用户登出请求
func (h *Handler) Logout(c *gin.Context) {
	token := getToken(c)
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未提供认证token"})
		return
	}
	// 调用服务层登出方法
	expiredCookie, err := h.dao.AuthDao.Logout(token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 设置过期的 cookie
	c.SetCookie(
		expiredCookie.Name,
		expiredCookie.Value,
		expiredCookie.MaxAge,
		expiredCookie.Path,
		expiredCookie.Domain,
		expiredCookie.Secure,
		expiredCookie.HttpOnly,
	)

	c.JSON(http.StatusOK, gin.H{"message": "登出成功"})
}
