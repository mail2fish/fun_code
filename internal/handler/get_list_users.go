package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetListUsers 获取用户列表，支持分页
func (h *Handler) GetListUsers(c *gin.Context) {
	// 检查 UserDao 是否初始化
	if h.dao.UserDao == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "UserDao not initialized",
		})
		return
	}

	// 获取分页参数
	pageSizeStr := c.DefaultQuery("pageSize", "20")
	beginIDStr := c.DefaultQuery("beginID", "0")
	forwardStr := c.DefaultQuery("forward", "true")
	ascStr := c.DefaultQuery("asc", "true")

	// 转换分页参数
	pageSize, err := strconv.ParseUint(pageSizeStr, 10, 64)
	if err != nil || pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	beginID, err := strconv.ParseUint(beginIDStr, 10, 64)
	if err != nil {
		beginID = 0
	}

	// 获取用户总数
	total, err := h.dao.UserDao.CountUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取用户总数失败: " + err.Error(),
		})
		return
	}

	// 解析布尔参数
	asc := ascStr == "true"
	forward := forwardStr == "true"

	// 获取用户列表
	users, hasMore, err := h.dao.UserDao.ListUsers(uint(pageSize), uint(beginID), forward, asc)
	if err != nil {
		lang := h.i18n.GetDefaultLanguage()
		if l := c.GetHeader("Accept-Language"); l != "" {
			lang = l
		}
		msg := h.i18n.Translate("user.list_failed", lang)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	// 返回结果
	c.JSON(http.StatusOK, gin.H{
		"data":    users,
		"hasMore": hasMore,
		"total":   total,
	})
}
