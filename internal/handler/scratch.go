package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetScratchProject(c *gin.Context) {
	projectID := c.Param("id")

	// 从 service 获取项目数据
	// 将 projectID 字符串转换为 uint 类型
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}
	projectData, err := h.scratchService.GetProject(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取项目失败",
		})
		return
	}

	// 设置响应头为二进制数据
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Length", strconv.Itoa(len(projectData)))

	// 直接写入字节数据
	c.Writer.Write(projectData)
}

// SaveScratchProject 保存Scratch项目
func (h *Handler) SaveScratchProject(c *gin.Context) {
	log.Println("dbg SaveScratchProject")
	// 获取当前用户ID
	userID := h.getUserID(c)

	// 解析请求参数
	var req struct {
		ID      uint            `json:"id"`
		Name    string          `json:"name"`
		Content json.RawMessage `json:"content"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求参数",
		})
		return
	}

	// 验证必要参数
	if req.Name == "" || len(req.Content) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "项目名称和内容不能为空",
		})
		return
	}

	// 保存项目
	projectID, err := h.scratchService.SaveProject(userID, req.ID, req.Name, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "保存项目失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id": projectID,
	})
}

// ListScratchProjects 列出用户的所有Scratch项目
func (h *Handler) ListScratchProjects(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)

	// 获取项目列表
	projects, err := h.scratchService.ListProjects(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取项目列表失败",
		})
		return
	}

	c.JSON(http.StatusOK, projects)
}

// DeleteScratchProject 删除Scratch项目
func (h *Handler) DeleteScratchProject(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)

	// 获取项目ID
	projectID := c.Param("id")
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}

	// 删除项目
	if err := h.scratchService.DeleteProject(userID, uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除项目失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "项目已删除",
	})
}

// getUserID 从上下文中获取当前用户ID
func (h *Handler) getUserID(c *gin.Context) uint {
	// 从上下文中获取用户信息
	userID, exists := c.Get("userID")
	if !exists {
		return 0
	}
	return userID.(uint)
}

// CreateScratchProject 创建新的Scratch项目
func (h *Handler) CreateScratchProject(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)

	// 解析请求参数
	req := make(map[string]interface{})

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求参数: " + err.Error(),
		})
		return
	}

	r, err := json.Marshal(req)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求参数: " + err.Error(),
		})
		return
	}

	// 调用服务创建项目（使用0表示新项目）
	projectID, err := h.scratchService.SaveProject(userID, 0, "default", r)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "创建项目失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id": projectID,
	})
}
