package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// SetUserRole 设置用户角色
func (h *Handler) SetUserRole(c *gin.Context) {
	// 只有管理员可以设置用户角色
	if !h.hasPermission(c, PermissionManageAll) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "只有管理员可以设置用户角色",
		})
		return
	}

	var req struct {
		UserID uint   `json:"user_id" binding:"required"`
		Role   string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 验证角色是否有效
	if req.Role != RoleAdmin && req.Role != RoleTeacher && req.Role != RoleStudent {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的角色",
		})
		return
	}

	// 更新用户角色
	updates := map[string]interface{}{
		"role": req.Role,
	}

	if err := h.services.UserDao.UpdateUser(req.UserID, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "设置用户角色失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "用户角色设置成功",
	})
}

// GetCurrentUserPermissions 获取当前用户的权限
func (h *Handler) GetCurrentUserPermissions(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	// 获取用户信息
	user, err := h.services.UserDao.GetUserByID(userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取用户信息失败: " + err.Error(),
		})
		return
	}

	// 获取用户角色对应的权限
	permissions, exists := rolePermissions[user.Role]
	if !exists {
		permissions = []string{}
	}

	c.JSON(http.StatusOK, gin.H{
		"role":        user.Role,
		"permissions": permissions,
	})
}
