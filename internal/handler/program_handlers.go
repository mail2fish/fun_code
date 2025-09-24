package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/mail2fish/gorails/gorails"
)

// CreateProgramParams 接收前端提交的程序内容
type CreateProgramParams struct {
	Name    string `json:"name" binding:"required"`
	Type    string `json:"type" binding:"required"`
	Program string `json:"program" binding:"required"`
}

func (p *CreateProgramParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(400, gorails.ERR_HANDLER, global.ERR_MODULE_PROGRAM, 40001, "无效的请求参数", err)
	}
	return nil
}

// CreateProgramResponse 响应
type CreateProgramResponse struct {
	Message string `json:"message"`
	Name    string `json:"name"`
	Type    string `json:"type"`
}

// CreateProgramHandler 简单接收并回显，后续可接入持久化
func (h *Handler) CreateProgramHandler(c *gin.Context, params *CreateProgramParams) (*CreateProgramResponse, *gorails.ResponseMeta, gorails.Error) {
	// 这里暂不做持久化，仅返回成功信息
	return &CreateProgramResponse{
		Message: "created",
		Name:    params.Name,
		Type:    params.Type,
	}, nil, nil
}
