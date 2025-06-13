package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
	"github.com/mail2fish/gorails/gorails"
)

// GetNewScratchProjectParams 获取新Scratch项目参数
type GetNewScratchProjectParams struct {
	// 暂无需要的参数
}

func (p *GetNewScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	// 暂无需要解析的参数
	return nil
}

// GetNewScratchProjectResponse 获取新Scratch项目响应
type GetNewScratchProjectResponse struct {
	ProjectID uint   `json:"project_id"`
	Status    string `json:"status"`
}

func (h *Handler) GetNewScratchProjectHandler(c *gin.Context, params *GetNewScratchProjectParams) (*GetNewScratchProjectResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 90001, "未登录", nil)
	}

	// 创建新项目
	projectID, err := h.dao.ScratchDao.CreateProject(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 90002, "创建项目失败", err)
	}

	return &GetNewScratchProjectResponse{
		ProjectID: projectID,
		Status:    "ok",
	}, nil, nil
}

// GetOpenScratchProjectParams 打开Scratch项目参数
type GetOpenScratchProjectParams struct {
	ID string `json:"id" uri:"id" binding:"required"`
}

func (p *GetOpenScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 90003, "无效的项目ID", err)
	}
	return nil
}

// GetOpenScratchProjectResponse 打开Scratch项目响应
type GetOpenScratchProjectResponse struct {
	ProjectID uint   `json:"project_id"`
	Status    string `json:"status"`
	Message   string `json:"message"`
}

func (h *Handler) GetOpenScratchProjectHandler(c *gin.Context, params *GetOpenScratchProjectParams) (*GetOpenScratchProjectResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 90004, "未登录", nil)
	}

	// 转换项目ID
	projectID, err := strconv.ParseUint(params.ID, 10, 32)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 90005, "无效的项目ID", err)
	}

	// 检查项目是否存在
	project, err := h.dao.ScratchDao.GetProject(uint(projectID))
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 90006, "项目不存在", err)
	}

	// 检查权限 - 只有项目所有者或管理员可以打开
	if project.UserID != userID && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 90007, "无权限访问", nil)
	}

	return &GetOpenScratchProjectResponse{
		ProjectID: uint(projectID),
		Status:    "ok",
		Message:   "项目打开成功",
	}, nil, nil
}
