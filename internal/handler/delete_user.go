package handler

import (
	"net/http"
	"slices"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
)

const (
	ErrorCodeInvalidID     = 1
	ErrorCodeProtectedUser = 2
)

// DeleteUser 删除用户
func (h *Handler) DeleteUser(c *gin.Context) {
	// 获取用户ID
	userIDStr := c.Param("user_id")
	userID, err := strconv.ParseUint(userIDStr, 10, 64)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.USER, ErrorCodeInvalidID, "invalid_id", err)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 判断是否为保护用户
	if slices.Contains(h.config.Protected.Users, uint(userID)) {
		e := custom_error.NewHandlerError(custom_error.USER, ErrorCodeProtectedUser, "protected_user", nil)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}
	// 执行删除操作
	err = h.dao.UserDao.DeleteUser(uint(userID))
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
		msg := h.i18n.Translate("user.delete_failed", lang)
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
		"message": h.i18n.Translate("user.delete_success", lang),
	})
}
