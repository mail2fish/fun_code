package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
	"github.com/jun/fun_code/internal/model"
)

// PostCreateUser 调用 dao 层的 CreateUser 方法，创建用户
// 参数通过 Post JSON 方式传递，格式如下：
// {"username":"testuser","nickname":"测试用户","password":"123456","email":"test@example.com","role":"student"}
func (h *Handler) PostCreateUser(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Nickname string `json:"nickname"`
		Password string `json:"password" binding:"required"`
		Email    string `json:"email"`
		Role     string `json:"role"`
	}

	// 解析请求参数
	if err := c.ShouldBindJSON(&req); err != nil {
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		msg := h.i18n.Translate("common.invalid_request", lang)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	// 构造用户模型
	user := &model.User{
		Username: req.Username,
		Nickname: req.Nickname,
		Password: req.Password,
		Email:    req.Email,
		Role:     req.Role,
	}

	// 调用服务层创建用户
	err := h.dao.UserDao.CreateUser(user)
	if err != nil {
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		// 判断是否为自定义错误
		if ce, ok := err.(*custom_error.CustomError); ok {
			msg := h.i18n.Translate(ce.Message, lang)
			c.JSON(http.StatusBadRequest, gin.H{"error": msg, "code": ce.Code})
			return
		}
		// 其他未知错误
		msg := h.i18n.Translate("user.create_failed", lang)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err.Error()})
		return
	}

	// 返回成功响应
	lang := h.i18n.GetDefaultLanguage()
	if l := c.GetHeader("Accept-Language"); l != "" {
		lang = l
	}
	c.JSON(http.StatusCreated, gin.H{
		"message": h.i18n.Translate("user.create_success", lang),
		"data": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"nickname": user.Nickname,
			"email":    user.Email,
			"role":     user.Role,
		},
	})
}
