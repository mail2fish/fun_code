package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
)

// PutUpdateUser 更新用户信息
func (h *Handler) PutUpdateUser(c *gin.Context) {
	// 获取用户ID
	userIDStr := c.Param("user_id")
	userID, err := strconv.ParseUint(userIDStr, 10, 64)
	if err != nil {
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		msg := h.i18n.Translate("common.invalid_id", lang)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	// 解析请求参数
	var req struct {
		Username string `json:"username"`
		Nickname string `json:"nickname"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		msg := h.i18n.Translate("common.invalid_request", lang)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	// 构建更新数据
	updates := make(map[string]interface{})
	if req.Username != "" {
		updates["username"] = req.Username
	}
	if req.Nickname != "" {
		updates["nickname"] = req.Nickname
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Password != "" {
		updates["password"] = req.Password
	}
	if req.Role != "" {
		// 验证角色是否有效
		if req.Role != "admin" && req.Role != "teacher" && req.Role != "student" {
			lang := h.i18n.GetDefaultLanguage()
			if l := c.GetHeader("Accept-Language"); l != "" {
				lang = l
			}
			msg := h.i18n.Translate("user.invalid_role", lang)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": msg,
			})
			return
		}
		updates["role"] = req.Role
	}

	// 如果没有要更新的字段
	if len(updates) == 0 {
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		msg := h.i18n.Translate("common.no_updates", lang)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	// 更新用户信息
	err = h.dao.UserDao.UpdateUser(uint(userID), updates)
	if err != nil {
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		// 判断是否为自定义错误
		if ce, ok := err.(*custom_error.CustomError); ok {
			msg := h.i18n.Translate(ce.Message, lang)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": msg,
				"code":  ce.Code,
			})
			return
		}
		// 其他未知错误
		msg := h.i18n.Translate("user.update_failed", lang)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	// 返回成功响应
	lang := h.i18n.GetDefaultLanguage()
	if l := c.GetHeader("Accept-Language"); l != "" {
		lang = l
	}
	c.JSON(http.StatusOK, gin.H{
		"message": h.i18n.Translate("user.update_success", lang),
	})
}
