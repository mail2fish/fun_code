package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PutUpdateClass 更新班级信息
func (h *Handler) PutUpdateClass(c *gin.Context) {
	// 获取班级ID
	classID := c.Param("class_id")

	// 将 classID 转换为 uint
	id, err := strconv.ParseUint(classID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": h.T("invalid_class_id", c),
		})
		return
	}

	// 获取当前用户ID（教师ID）
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": h.T("unauthorized", c),
		})
		return
	}
	teacherID := userID.(uint)

	// 解析请求体
	var requestBody struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		StartDate   string `json:"start_date"`
		EndDate     string `json:"end_date"`
		IsActive    bool   `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&requestBody); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": h.T("invalid_request", c),
		})
		return
	}

	// 验证班级名称
	if requestBody.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": h.T("class_name_required", c),
		})
		return
	}

	// 构建更新数据
	updates := map[string]interface{}{
		"name":        requestBody.Name,
		"description": requestBody.Description,
		"is_active":   requestBody.IsActive,
	}

	// 如果提供了日期，则添加到更新数据中
	if requestBody.StartDate != "" {
		updates["start_date"] = requestBody.StartDate
	}

	if requestBody.EndDate != "" {
		updates["end_date"] = requestBody.EndDate
	}

	// 调用服务层更新班级信息
	err = h.services.ClassDao.UpdateClass(uint(id), teacherID, updates)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || err.Error() == "班级不存在或您无权修改" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": h.T("class_not_found", c),
			})
			return
		}

		// 处理日期格式错误
		if err.Error() == "开始日期格式无效" || err.Error() == "结束日期格式无效" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": h.TWithData("class_update_failed", c, map[string]interface{}{
					"Error": err.Error(),
				}),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": h.TWithData("class_update_failed", c, map[string]interface{}{
				"Error": err.Error(),
			}),
		})
		return
	}

	// 获取更新后的班级信息
	updatedClass, err := h.services.ClassDao.GetClass(uint(id))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": h.T("class_update_success", c),
		})
		return
	}

	// 格式化日期
	startDate := updatedClass.StartDate.Format("2006-01-02")
	endDate := updatedClass.EndDate.Format("2006-01-02")

	// 构建响应数据
	response := gin.H{
		"id":          updatedClass.ID,
		"name":        updatedClass.Name,
		"description": updatedClass.Description,
		"code":        updatedClass.Code,
		"teacher_id":  updatedClass.TeacherID,
		"start_date":  startDate,
		"end_date":    endDate,
		"is_active":   updatedClass.IsActive,
		"created_at":  updatedClass.CreatedAt,
		"updated_at":  updatedClass.UpdatedAt,
	}

	c.JSON(http.StatusOK, gin.H{
		"message": h.T("class_update_success", c),
		"data":    response,
	})
}
