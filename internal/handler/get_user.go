package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
)

// GetUser 获取用户信息
// @Summary 获取用户信息
// @Description 获取指定用户的信息
// @Tags users
// @Accept json
// @Produce json
// @Param user_id path string true "用户ID"
// @Success 200 {object} ResponseOk
// @Failure 400 {object} ResponseError
// @Failure 500 {object} ResponseError
// @Router /api/admin/users/{user_id} [get]
// @Response 200 {object} ResponseOk

func (h *Handler) GetUser(c *gin.Context) {
	// 获取语言设置
	lang := h.i18n.GetDefaultLanguage()
	if l := c.GetHeader("Accept-Language"); l != "" {
		lang = l
	}

	// 获取用户ID
	userIDStr := c.Param("user_id")
	userID, err := strconv.ParseUint(userIDStr, 10, 64)
	if err != nil {
		msg := h.i18n.Translate("common.invalid_id", lang)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(custom_error.GetErrorCode(err)),
			Message: msg,
			Error:   err.Error(),
		})
		return
	}

	// 获取用户信息
	user, err := h.dao.UserDao.GetUserByID(uint(userID))
	if err != nil {
		// 判断是否为自定义错误
		if ce, ok := err.(*custom_error.CustomError); ok {
			msg := h.i18n.Translate(ce.Message, lang)
			c.JSON(http.StatusBadRequest, ResponseError{
				Code:    int(ce.ErrorCode()),
				Message: msg,
				Error:   err.Error(),
			})
			return
		}
		// 其他未知错误
		msg := h.i18n.Translate("user.get_failed", lang)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(custom_error.GetErrorCode(err)),
			Message: msg,
			Error:   err.Error(),
		})
		return
	}

	// 返回成功响应
	c.JSON(http.StatusOK, ResponseOk{
		Data: gin.H{
			"id":       user.ID,
			"username": user.Username,
			"nickname": user.Nickname,
			"email":    user.Email,
			"role":     user.Role,
		},
	})
}
