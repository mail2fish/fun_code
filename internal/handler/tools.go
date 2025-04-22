package handler

import "github.com/gin-gonic/gin"

// getUserID 从上下文中获取当前用户ID
func (h *Handler) getUserID(c *gin.Context) uint {
	// 从上下文中获取用户信息
	userID, exists := c.Get("userID")
	if !exists {
		return 0
	}
	return userID.(uint)
}
