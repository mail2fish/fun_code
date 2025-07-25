package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// 角色常量
const (
	RoleAdmin   = "admin"   // 管理员
	RoleTeacher = "teacher" // 教师
	RoleStudent = "student" // 学生
)

// 权限常量
const (
	PermissionManageAll         = "manage_all"          // 管理所有资源
	PermissionManageClass       = "manage_class"        // 管理班级
	PermissionManageOwnClass    = "manage_own_class"    // 管理自己的班级
	PermissionManageOwnStudents = "manage_own_students" // 管理自己班级的学生
	PermissionCreateScratch     = "create_scratch"      // 创建Scratch项目
	PermissionViewOwnScratch    = "view_own_scratch"    // 查看自己的Scratch项目
	PermissionEditOwnScratch    = "edit_own_scratch"    // 编辑自己的Scratch项目
	PermissionViewClassScratch  = "view_class_scratch"  // 查看班级的Scratch项目
	PermissionViewCourseScratch = "view_course_scratch" // 查看课程的Scratch项目
)

// 角色权限映射
var rolePermissions = map[string][]string{
	RoleAdmin: {
		PermissionManageAll,
	},
	RoleTeacher: {
		PermissionManageOwnClass,
		PermissionManageOwnStudents,
		PermissionCreateScratch,
		PermissionViewOwnScratch,
		PermissionEditOwnScratch,
		PermissionViewClassScratch,
		PermissionViewCourseScratch,
	},
	RoleStudent: {
		PermissionCreateScratch,
		PermissionViewOwnScratch,
		PermissionEditOwnScratch,
		PermissionViewClassScratch,
		PermissionViewCourseScratch,
	},
}

// 检查用户是否有指定权限
func (h *Handler) hasPermission(c *gin.Context, permission string) bool {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return false
	}

	// 获取用户信息
	user, err := h.dao.UserDao.GetUserByID(userID)
	if err != nil {
		return false
	}

	// 如果是管理员，拥有所有权限
	if user.Role == RoleAdmin {
		return true
	}

	// 检查用户角色是否有该权限
	permissions, exists := rolePermissions[user.Role]
	if !exists {
		return false
	}

	// 检查特定权限
	for _, p := range permissions {
		if p == permission {
			return true
		}
	}

	return false
}

// RequirePermission 中间件，用于检查用户是否有指定权限
func (h *Handler) RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !h.hasPermission(c, permission) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "没有权限执行此操作",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// 检查用户是否是资源所有者
func (h *Handler) isResourceOwner(c *gin.Context, resourceType string, resourceID uint) bool {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return false
	}

	switch resourceType {
	case "scratch_project":
		project, err := h.dao.ScratchDao.GetProject(resourceID)
		if err != nil {
			return false
		}
		return project.UserID == userID
	case "class":
		class, err := h.dao.ClassDao.GetClass(resourceID)
		if err != nil {
			return false
		}
		return class.TeacherID == userID
	}
	return false
}

// RequireOwnership 中间件，用于检查用户是否是资源所有者
func (h *Handler) RequireOwnership(resourceType string, idParam string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从路径参数获取资源ID
		resourceIDStr := c.Param(idParam)
		resourceID, err := strconv.ParseUint(resourceIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "无效的资源ID",
			})
			c.Abort()
			return
		}

		// 检查用户是否是管理员
		if h.hasPermission(c, PermissionManageAll) {
			c.Next()
			return
		}

		// 检查用户是否是资源所有者
		if !h.isResourceOwner(c, resourceType, uint(resourceID)) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "您不是该资源的所有者",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// 检查用户是否是班级成员
func (h *Handler) isClassMember(c *gin.Context, classID uint) bool {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return false
	}

	// 获取班级信息
	class, err := h.dao.ClassDao.GetClass(classID)
	if err != nil {
		return false
	}

	// 如果是班级的教师，则是成员
	if class.TeacherID == userID {
		return true
	}

	// 检查是否是班级的学生
	for _, student := range class.Students {
		if student.ID == userID {
			return true
		}
	}

	return false
}

// RequireClassMembership 中间件，用于检查用户是否是班级成员
func (h *Handler) RequireClassMembership(classIDParam string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从路径参数获取班级ID
		classIDStr := c.Param(classIDParam)
		classID, err := strconv.ParseUint(classIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "无效的班级ID",
			})
			c.Abort()
			return
		}

		// 检查用户是否是管理员
		if h.hasPermission(c, PermissionManageAll) {
			c.Next()
			return
		}

		// 检查用户是否是班级成员
		if !h.isClassMember(c, uint(classID)) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "您不是该班级的成员",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
