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
				{
					Title:    "上传资源文件",
					URL:      "/www/admin/files/upload",
					IsActive: false,
				},
				{
					Title:    "资源文件列表",
					URL:      "/www/admin/files/list",
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
				Title:    "资源文件列表",
				URL:      "/www/files/list",
				IsActive: false,
			},
			{
				Title:    "我的分享",
				URL:      "/www/shares/user",
				IsActive: false,
			},
			{
				Title:    "全部分享",
				URL:      "/www/shares/all",
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
