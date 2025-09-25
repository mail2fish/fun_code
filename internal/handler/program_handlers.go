package handler

import (
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
