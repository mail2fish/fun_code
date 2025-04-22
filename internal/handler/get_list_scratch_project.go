package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ListScratchProjects 列出用户的所有Scratch项目
func (h *Handler) ListScratchProjects(c *gin.Context) {
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

	// 获取项目总数
	total, err := h.dao.ScratchDao.CountProjects(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取项目总数失败: " + err.Error(),
		})
		return
	}

	// 解析布尔参数
	asc := ascStr == "true"
	forward := forwardStr == "true"

	// 获取项目列表
	projects, hasMore, err := h.dao.ScratchDao.ListProjectsWithPagination(userID, uint(pageSize), uint(beginID), forward, asc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取项目列表失败: " + err.Error(),
		})
		return
	}

	// 返回结果
	c.JSON(http.StatusOK, gin.H{
		"data":    projects,
		"hasMore": hasMore,
		"total":   total,
	})
}
