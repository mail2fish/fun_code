package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetListClasses 列出教师创建的所有班级（分页）
func (h *Handler) GetListClasses(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)

	// 获取分页参数
	pageSizeStr := c.DefaultQuery("pageSize", "20")
	beginIDStr := c.DefaultQuery("beginID", "0")
	forwardStr := c.DefaultQuery("forward", "true")
	ascStr := c.DefaultQuery("asc", "true")

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}

	beginID, err := strconv.ParseUint(beginIDStr, 10, 64)
	if err != nil {
		beginID = 0
	}

	// 解析布尔参数
	asc := ascStr == "true"
	forward := forwardStr == "true"

	// 获取班级列表
	classes, hasMore, err := h.dao.ClassDao.ListClassesWithPagination(userID, uint(pageSize), uint(beginID), forward, asc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取班级列表失败: " + err.Error(),
		})
		return
	}

	// 获取班级总数
	// 这里可以添加一个计算班级总数的方法，类似于 CountProjects
	// 暂时使用 0 作为占位符
	var total int64 = 0

	// 返回结果
	c.JSON(http.StatusOK, gin.H{
		"data":    classes,
		"hasMore": hasMore,
		"total":   total,
	})
}
