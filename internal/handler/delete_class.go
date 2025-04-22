package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
)

// DeleteClass 删除班级
func (h *Handler) DeleteClass(c *gin.Context) {
	// 获取班级ID
	classIDStr := c.Param("class_id")
	classID, err := strconv.ParseUint(classIDStr, 10, 64)
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

	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		msg := h.i18n.Translate("common.unauthorized", lang)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": msg,
		})
		return
	}

	// 执行删除操作
	err = h.dao.ClassDao.DeleteClass(uint(classID), userID)
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
		msg := h.i18n.Translate("class.delete_failed", lang)
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
		"message": h.i18n.Translate("class.delete_success", lang),
	})
}
