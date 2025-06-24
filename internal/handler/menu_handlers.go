package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/mail2fish/gorails/gorails"
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

// GetMenuListResponse 获取菜单列表响应
type GetMenuListResponse []MenuGroup

// GetMenuListHandler 获取菜单列表 gorails.Wrap 形式
func (h *Handler) GetMenuListHandler(c *gin.Context, params *gorails.EmptyParams) (*GetMenuListResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_USER, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 从数据库获取用户信息
	user, err := h.dao.UserDao.GetUserByID(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_USER, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 根据用户角色返回不同的菜单
	var menuGroups []MenuGroup

	// 管理员和教师可以看到管理菜单
	if user.Role == "admin" || user.Role == "teacher" {
		menuGroups = append(menuGroups, MenuGroup{
			Title: "用户管理",
			URL:   "#",
			Items: []MenuItem{
				{
					Title:    "用户列表",
					URL:      "/admin/list_users",
					IsActive: false,
				},
				{
					Title:    "创建用户",
					URL:      "/admin/create_user",
					IsActive: false,
				},
			},
		})

		menuGroups = append(menuGroups, MenuGroup{
			Title: "班级管理",
			URL:   "#",
			Items: []MenuItem{
				{
					Title:    "班级列表",
					URL:      "/admin/list_classes",
					IsActive: false,
				},
				{
					Title:    "创建班级",
					URL:      "/admin/create_class",
					IsActive: false,
				},
			},
		})

		menuGroups = append(menuGroups, MenuGroup{
			Title: "课程管理",
			URL:   "#",
			Items: []MenuItem{
				{
					Title:    "课程列表",
					URL:      "/admin/list_courses",
					IsActive: false,
				},
				{
					Title:    "创建课程",
					URL:      "/admin/create_course",
					IsActive: false,
				},
			},
		})

		menuGroups = append(menuGroups, MenuGroup{
			Title: "文件管理",
			URL:   "#",
			Items: []MenuItem{
				{
					Title:    "上传资源文件",
					URL:      "/admin/upload_files",
					IsActive: false,
				},
				{
					Title:    "资源文件列表",
					URL:      "/list_files",
					IsActive: false,
				},
				{
					Title:    "所有程序列表",
					URL:      "/scratch_projects",
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
				URL:      "/scratch_projects",
				IsActive: false,
			},
			{
				Title:    "程序历史记录",
				URL:      "/scratch_project_histories",
				IsActive: false,
			},
			{
				Title:    "我的分享",
				URL:      "/user_share",
				IsActive: false,
			},
			{
				Title:    "全部分享",
				URL:      "/all_share",
				IsActive: false,
			},
			{
				Title:    "新建Scratch程序",
				URL:      "/projects/scratch/new",
				IsActive: false,
			},
		},
	})

	response := GetMenuListResponse(menuGroups)
	return &response, nil, nil
}
