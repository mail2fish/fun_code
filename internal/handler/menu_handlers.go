package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
	"github.com/mail2fish/gorails/gorails"
)

// GetMenuListParams 获取菜单列表请求参数
type GetMenuListParams struct {
	// 无需参数
}

func (p *GetMenuListParams) Parse(c *gin.Context) gorails.Error {
	// 无需解析参数
	return nil
}

// GetMenuListResponse 获取菜单列表响应
type GetMenuListResponse []MenuGroup

// GetMenuListHandler 获取菜单列表 gorails.Wrap 形式
func (h *Handler) GetMenuListHandler(c *gin.Context, params *GetMenuListParams) (*GetMenuListResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 70001, "未登录", nil)
	}

	// 从数据库获取用户信息
	user, err := h.dao.UserDao.GetUserByID(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 70002, "获取用户信息失败", err)
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
				Title:    "分享程序列表",
				URL:      "/www/shares/list",
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
