package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// MenuItem 表示单个菜单项
type MenuItem struct {
	Title    string `json:"title"`
	URL      string `json:"url"`
	IsActive bool   `json:"isActive"`
}

// MenuGroup 表示菜单组
type MenuGroup struct {
	Title string     `json:"title"`
	URL   string     `json:"url"`
	Items []MenuItem `json:"items"`
}

// GetMenuList 获取菜单列表
func (h *Handler) GetMenuList(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}

	// 从数据库获取用户信息
	user, err := h.dao.UserDao.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户信息失败"})
		return
	}

	// 根据用户角色返回不同的菜单
	var menuGroups []MenuGroup

	// 管理员和教师可以看到管理菜单
	if user.Role == "admin" || user.Role == "teacher" {
		menuGroups = append(menuGroups, MenuGroup{
			Title: "管理菜单",
			URL:   "#",
			Items: []MenuItem{
				{
					Title:    "用户列表",
					URL:      "/www/admin/users/list",
					IsActive: false,
				},
				{
					Title:    "创建用户",
					URL:      "/www/admin/users/create",
					IsActive: false,
				},
				{
					Title:    "所有程序列表",
					URL:      "/www/admin/scratch/projects",
					IsActive: false,
				},
			},
		})
	}

	// 所有用户都可以看到 Scratch 程序菜单
	menuGroups = append(menuGroups, MenuGroup{
		Title: "Scratch程序",
		URL:   "#",
		Items: []MenuItem{
			{
				Title:    "我的程序列表",
				URL:      "/www/scratch/projects",
				IsActive: false,
			},
			{
				Title:    "新建Scratch程序",
				URL:      "/projects/scratch/new",
				IsActive: false,
			},
		},
	})

	c.JSON(http.StatusOK, menuGroups)
}
