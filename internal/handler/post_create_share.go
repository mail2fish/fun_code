package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/dao"
	"github.com/mail2fish/gorails/gorails"
)

const (
	MODULE_SHARE gorails.ErrorModule = 2
)

// CreateShareParams 创建分享链接的请求参数
type CreateShareParams struct {
	ProjectID     uint   `json:"project_id" binding:"required"`
	ProjectType   int    `json:"project_type" binding:"required"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	MaxViews      int64  `json:"max_views"`
	AllowDownload bool   `json:"allow_download"`
	AllowRemix    bool   `json:"allow_remix"`
}

func (p *CreateShareParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 1, "无效的请求参数", err)
	}
	return nil
}

// CreateShareResponse 创建分享链接的响应
type CreateShareResponse struct {
	ShareToken string `json:"share_token"`
	Title      string `json:"title"`
	MaxViews   int64  `json:"max_views"`
}

// CreateShareHandler 处理创建分享链接的请求
func (h *Handler) CreateShareHandler(c *gin.Context, params *CreateShareParams) (*CreateShareResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 2, "用户未登录", nil)
	}

	// 获取 shareDao 实例
	shareDao := h.dao.ShareDao

	// 构建创建分享请求
	req := &dao.CreateShareRequest{
		ProjectID:     params.ProjectID,
		ProjectType:   params.ProjectType,
		UserID:        userID,
		Title:         params.Title,
		Description:   params.Description,
		MaxViews:      params.MaxViews,
		AllowDownload: params.AllowDownload,
		AllowRemix:    params.AllowRemix,
	}

	// 创建分享
	share, err := shareDao.CreateShare(req)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 3, "创建分享失败", err)
	}

	// 返回响应
	return &CreateShareResponse{
		ShareToken: share.ShareToken,
		Title:      share.Title,
		MaxViews:   share.MaxViews,
	}, nil, nil
}
