package handler

import "github.com/gin-gonic/gin"

// PostCreateClass 调用 service 层的 CreateClass 方法，创建班级
// 参数是通过Post JSON 方式传递，格式如下：
// {"name":"2025 scratch 测试班","description":"测试测试","start_date":"2025-04-16","end_date":"2025-08-16"}
func (h *Handler) PostCreateClass(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)

	// 定义请求结构
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		StartDate   string `json:"start_date" binding:"required"`
		EndDate     string `json:"end_date" binding:"required"`
	}

	// 解析请求参数
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "无效的请求参数", "details": err.Error()})
		return
	}

	// 调用服务层创建班级
	class, err := h.services.ClassService.CreateClass(userID, req.Name, req.Description, req.StartDate, req.EndDate)
	if err != nil {
		c.JSON(400, gin.H{"error": "创建班级失败", "details": err.Error()})
		return
	}

	// 返回成功响应
	c.JSON(201, gin.H{
		"message": "班级创建成功",
		"data": gin.H{
			"id":          class.ID,
			"name":        class.Name,
			"description": class.Description,
			"code":        class.Code,
			"teacher_id":  class.TeacherID,
			"start_date":  class.StartDate.Format("2006-01-02"),
			"end_date":    class.EndDate.Format("2006-01-02"),
			"is_active":   class.IsActive,
		},
	})
}

