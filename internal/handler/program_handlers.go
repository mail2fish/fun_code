package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
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
    UserID  uint   `json:"user_id"`
    OwnerUsername string `json:"owner_username"`
    OwnerNickname string `json:"owner_nickname"`
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

    // 获取作者信息（用于前端显示标题）
    var ownerUsername, ownerNickname string
    if u, err := h.dao.UserDao.GetUserByID(prog.UserID); err == nil && u != nil {
        ownerUsername = u.Username
        ownerNickname = u.Nickname
        if ownerNickname == "" {
            ownerNickname = ownerUsername
        }
    }

    resp := &GetProgramResponse{ID: prog.ID, Name: prog.Name, Ext: prog.Ext, Program: string(content), UserID: prog.UserID, OwnerUsername: ownerUsername, OwnerNickname: ownerNickname}
	return resp, nil, nil
}

// ListProgramsParams 列出程序参数
type ListProgramsParams struct {
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
}

func (p *ListProgramsParams) Parse(c *gin.Context) gorails.Error {
	// 设置默认值
	p.PageSize = 20
	p.BeginID = 0
	p.Forward = true
	p.Asc = true

	// 解析页面大小
	if pageSizeStr := c.DefaultQuery("pageSize", "20"); pageSizeStr != "" {
		if pageSize, err := strconv.ParseUint(pageSizeStr, 10, 32); err == nil {
			if pageSize > 0 && pageSize <= 100 {
				p.PageSize = uint(pageSize)
			}
		}
	}

	// 解析起始ID
	if beginIDStr := c.DefaultQuery("beginID", "0"); beginIDStr != "" {
		if beginID, err := strconv.ParseUint(beginIDStr, 10, 32); err == nil {
			p.BeginID = uint(beginID)
		}
	}

	// 解析翻页方向
	if forwardStr := c.DefaultQuery("forward", "true"); forwardStr != "" {
		p.Forward = forwardStr != "false"
	}

	// 解析排序方向
	if ascStr := c.DefaultQuery("asc", "true"); ascStr != "" {
		p.Asc = ascStr != "false"
	}
	return nil
}

type ProgramInfo struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	Ext       int       `json:"ext"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	UserID    uint      `json:"user_id"`
}

func (h *Handler) ListProgramsHandler(c *gin.Context, params *ListProgramsParams) ([]model.Program, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 获取程序列表
	programs, hasMore, err := h.dao.ProgramDao.ListProgramsWithPagination(userID, params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 获取总数
	total, err := h.dao.ProgramDao.CountPrograms(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return programs, &gorails.ResponseMeta{
		Total:   int(total),
		HasNext: hasMore,
	}, nil
}

// AdminListProgramsParams 管理员程序列表参数
type AdminListProgramsParams struct {
	PageSize uint  `form:"pageSize" binding:"required"`
	BeginID  uint  `form:"beginID"`
	Forward  bool  `form:"forward"`
	Asc      bool  `form:"asc"`
	UserID   *uint `form:"userId"`
}

// AdminSearchProgramsParams 管理员程序搜索参数
type AdminSearchProgramsParams struct {
	Keyword string `form:"keyword" binding:"required"`
	UserID  *uint  `form:"userId"`
}

// AdminDeleteProgramParams 管理员删除程序参数
type AdminDeleteProgramParams struct {
	ID uint `uri:"id" binding:"required"`
}

func (p *AdminListProgramsParams) Parse(c *gin.Context) gorails.Error {
	// 设置默认值
	p.PageSize = 20
	p.BeginID = 0
	p.Forward = true
	p.Asc = true
	p.UserID = nil

	// 解析页面大小
	if pageSizeStr := c.DefaultQuery("pageSize", "20"); pageSizeStr != "" {
		if pageSize, err := strconv.ParseUint(pageSizeStr, 10, 32); err == nil {
			if pageSize > 0 && pageSize <= 100 {
				p.PageSize = uint(pageSize)
			}
		}
	}

	// 解析起始ID
	if beginIDStr := c.DefaultQuery("beginID", "0"); beginIDStr != "" {
		if beginID, err := strconv.ParseUint(beginIDStr, 10, 32); err == nil {
			p.BeginID = uint(beginID)
		}
	}

	// 解析方向
	if forwardStr := c.DefaultQuery("forward", "true"); forwardStr != "" {
		if forward, err := strconv.ParseBool(forwardStr); err == nil {
			p.Forward = forward
		}
	}

	// 解析排序
	if ascStr := c.DefaultQuery("asc", "true"); ascStr != "" {
		if asc, err := strconv.ParseBool(ascStr); err == nil {
			p.Asc = asc
		}
	}

	// 解析用户ID（可选）
	if userIdStr := c.Query("userId"); userIdStr != "" {
		if userId, err := strconv.ParseUint(userIdStr, 10, 32); err == nil {
			userIdUint := uint(userId)
			p.UserID = &userIdUint
		}
	}

	return nil
}

func (p *AdminSearchProgramsParams) Parse(c *gin.Context) gorails.Error {
	// 解析关键词
	if keyword := c.Query("keyword"); keyword != "" {
		p.Keyword = keyword
	} else {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	// 解析用户ID（可选）
	p.UserID = nil
	if userIdStr := c.Query("userId"); userIdStr != "" {
		if userId, err := strconv.ParseUint(userIdStr, 10, 32); err == nil {
			userIdUint := uint(userId)
			p.UserID = &userIdUint
		}
	}

	return nil
}

func (p *AdminDeleteProgramParams) Parse(c *gin.Context) gorails.Error {
	// 解析ID
	if idStr := c.Param("id"); idStr != "" {
		if id, err := strconv.ParseUint(idStr, 10, 32); err == nil {
			p.ID = uint(id)
		} else {
			return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
		}
	} else {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	return nil
}

// AdminListProgramsHandler 管理员获取所有程序列表
func (h *Handler) AdminListProgramsHandler(c *gin.Context, params *AdminListProgramsParams) ([]model.Program, *gorails.ResponseMeta, gorails.Error) {
	// 获取程序列表
	programs, hasMore, err := h.dao.ProgramDao.ListAllProgramsWithPagination(params.PageSize, params.BeginID, params.Forward, params.Asc, params.UserID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 获取总数
	total, err := h.dao.ProgramDao.CountAllPrograms(params.UserID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return programs, &gorails.ResponseMeta{
		Total:   int(total),
		HasNext: hasMore,
	}, nil
}

// AdminSearchProgramsHandler 管理员搜索程序
func (h *Handler) AdminSearchProgramsHandler(c *gin.Context, params *AdminSearchProgramsParams) ([]model.Program, *gorails.ResponseMeta, gorails.Error) {
	// 搜索程序
	programs, err := h.dao.ProgramDao.SearchPrograms(params.Keyword, params.UserID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return programs, &gorails.ResponseMeta{
		Total:   len(programs),
		HasNext: false,
	}, nil
}

// AdminDeleteProgramHandler 管理员删除程序
func (h *Handler) AdminDeleteProgramHandler(c *gin.Context, params *AdminDeleteProgramParams) (*gorails.ResponseEmpty, *gorails.ResponseMeta, gorails.Error) {
	// 检查程序是否存在
	program, err := h.dao.ProgramDao.Get(params.ID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
	}
	if program == nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, nil)
	}

	// 删除程序
	err = h.dao.ProgramDao.Delete(params.ID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, global.ErrorCodeDeleteFailed, global.ErrorMsgDeleteFailed, err)
	}

	return &gorails.ResponseEmpty{}, nil, nil
}
