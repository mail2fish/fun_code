package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetClass 通过 id 获取班级信息
func (h *Handler) GetClass(c *gin.Context) {
	classID := c.Param("class_id")

	// 将 classID 转换为 uint
	id, err := strconv.ParseUint(classID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的班级ID",
		})
		return
	}

	// 调用服务层获取班级信息
	class, err := h.dao.ClassDao.GetClass(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || err.Error() == "班级不存在" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "班级不存在",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取班级信息失败: " + err.Error(),
		})
		return
	}

	// 格式化日期
	startDate := class.StartDate.Format("2006-01-02")
	endDate := class.EndDate.Format("2006-01-02")

	// 构建响应数据
	response := gin.H{
		"id":          class.ID,
		"name":        class.Name,
		"description": class.Description,
		"code":        class.Code,
		"teacher_id":  class.TeacherID,
		"start_date":  startDate,
		"end_date":    endDate,
		"is_active":   class.IsActive,
		"created_at":  class.CreatedAt,
		"updated_at":  class.UpdatedAt,
	}

	// 如果预加载了教师信息，则添加到响应中
	if class.Teacher.ID > 0 {
		response["teacher"] = gin.H{
			"id":       class.Teacher.ID,
			"username": class.Teacher.Username,
			"email":    class.Teacher.Email,
		}
	}

	// 如果预加载了学生信息，则添加到响应中
	if len(class.Students) > 0 {
		students := make([]gin.H, 0, len(class.Students))
		for _, student := range class.Students {
			students = append(students, gin.H{
				"id":       student.ID,
				"username": student.Username,
				"email":    student.Email,
			})
		}
		response["students"] = students
		response["students_count"] = len(students)
	} else {
		response["students_count"] = 0
	}

	// 如果预加载了课程信息，则添加到响应中
	if len(class.Courses) > 0 {
		courses := make([]gin.H, 0, len(class.Courses))
		for _, course := range class.Courses {
			courses = append(courses, gin.H{
				"id":          course.ID,
				"title":       course.Title,
				"description": course.Description,
				"author_id":   course.AuthorID,
			})
		}
		response["courses"] = courses
		response["courses_count"] = len(courses)
	} else {
		response["courses_count"] = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"data": response,
	})
}
