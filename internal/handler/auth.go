package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

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

func (h *Handler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数无效"})
		return
	}

	token, cookie, err := h.dao.AuthDao.Login(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// 设置 cookie
	c.SetCookie(
		cookie.Name,
		cookie.Value,
		cookie.MaxAge,
		cookie.Path,
		cookie.Domain,
		cookie.Secure,
		cookie.HttpOnly,
	)

	c.JSON(http.StatusOK, gin.H{"token": token})
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

// AuthMiddleware 认证中间件, 用于验证用户身份
func (h *Handler) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := getToken(c)
		if token == "" {
			// 移除 c.JSON 调用
			// e := custom_error.NewHandlerError(custom_error.AUTH, ErrorCodeUnauthorized, "unauthorized", nil)
			// c.JSON(http.StatusUnauthorized, ResponseError{
			// 	Code:    int(e.ErrorCode()),
			// 	Message: e.Message,
			// 	Error:   e.Error(),
			// })
			// 重定向到首页
			c.Redirect(http.StatusFound, "/")
			c.Abort()
			return
		}

		claims, err := h.dao.AuthDao.ValidateToken(token)
		if err != nil {
			// 移除 c.JSON 调用
			// e := custom_error.NewHandlerError(custom_error.AUTH, ErrorCodeUnauthorized, "unauthorized", err)
			// c.JSON(http.StatusUnauthorized, ResponseError{
			// 	Code:    int(e.ErrorCode()),
			// 	Message: e.Message,
			// 	Error:   e.Error(),
			// })
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
