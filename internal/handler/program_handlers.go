package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/mail2fish/gorails/gorails"
)

// SaveProgramParams 接收前端提交的程序内容
type SaveProgramParams struct {
	ID      uint   `json:"id"`
	Name    string `json:"name" binding:"required"`
	Type    string `json:"type" binding:"required"`
	Program string `json:"program" binding:"required"`
}

func (p *SaveProgramParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(400, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, 40001, "无效的请求参数", err)
	}
	return nil
}

// SaveProgramResponse 响应
type SaveProgramResponse struct {
	ID      uint   `json:"id"`
	Message string `json:"message"`
}

// SaveProgramHandler 简单接收并回显，后续可接入持久化
func (h *Handler) SaveProgramHandler(c *gin.Context, params *SaveProgramParams) (*SaveProgramResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)
	ext := mapProgramTypeToExt(params.Type)
	// 更新时校验作者或管理员权限
	if params.ID != 0 {
		prog, err := h.dao.ProgramDao.Get(params.ID)
		if err != nil {
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
		}
		if prog.UserID != userID && !h.hasPermission(c, PermissionManageAll) {
			return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeNoPermission, "无权修改该程序", nil)
		}
	}
	id, err := h.dao.ProgramDao.Save(userID, params.ID, params.Name, ext, []byte(params.Program))
	if err != nil {
		return nil, nil, gorails.NewError(500, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeInsertFailed, "保存程序失败", err)
	}
	return &SaveProgramResponse{ID: id, Message: "created"}, nil, nil
}

func mapProgramTypeToExt(t string) int {
	switch t {
	case "python", "py":
		return 1
	case "javascript", "js":
		return 2
	case "typescript", "ts":
		return 3
	case "go", "golang":
		return 4
	case "java":
		return 5
	default:
		return 0
	}
}

// GetProgramParams 获取程序详情的请求参数
type GetProgramParams struct {
	ID uint `uri:"id" binding:"required"`
}

func (p *GetProgramParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetProgramResponse 获取程序详情响应
type GetProgramResponse struct {
	ID      uint   `json:"id"`
	Name    string `json:"name"`
	Ext     int    `json:"ext"`
	Program string `json:"program"`
}

// GetProgramHandler 根据 ID 返回程序的元信息和最新内容
func (h *Handler) GetProgramHandler(c *gin.Context, params *GetProgramParams) (*GetProgramResponse, *gorails.ResponseMeta, gorails.Error) {
	prog, err := h.dao.ProgramDao.Get(params.ID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
	}
	// 仅作者或管理员可读
	if prog.UserID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeNoPermission, "无权读取该程序", nil)
	}

	content, err := h.dao.ProgramDao.GetContent(params.ID, "")
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	resp := &GetProgramResponse{ID: prog.ID, Name: prog.Name, Ext: prog.Ext, Program: string(content)}
	return resp, nil, nil
}
