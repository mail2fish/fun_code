package dao

import (
	"time"

	"github.com/jun/fun_code/internal/model"
)

// ShareDao 定义了分享服务的接口
type ShareDao interface {
	// CreateShare 创建分享链接
	CreateShare(req *CreateShareRequest) (*model.Share, error)

	// GetShareByToken 通过token获取分享信息
	GetShareByToken(token string) (*model.Share, error)

	// RecordView 记录访问并检查访问限制
	RecordView(shareID uint) error

	// ReshareProject 重新分享项目（重置访问计数）
	ReshareProject(shareID uint, userID uint) error

	// GetUserShares 获取用户的分享列表
	GetUserShares(userID uint, page, pageSize int) ([]model.Share, int64, error)

	// UpdateShare 更新分享信息
	UpdateShare(shareID uint, userID uint, updates map[string]interface{}) error

	// DeleteShare 删除分享（软删除，设置为不活跃）
	DeleteShare(shareID uint, userID uint) error

	// GetShareStats 获取分享统计信息
	GetShareStats(shareID uint) (map[string]interface{}, error)

	// CheckShareAccess 检查分享是否可访问（包括访问次数限制）
	CheckShareAccess(share *model.Share) error
}

// CreateShareRequest 创建分享链接的请求参数
type CreateShareRequest struct {
	ProjectID     uint       `json:"project_id" binding:"required"`
	ProjectType   int        `json:"project_type" binding:"required"` // 项目类型
	UserID        uint       `json:"user_id" binding:"required"`
	Title         string     `json:"title"`
	Description   string     `json:"description"`
	ExpiresAt     *time.Time `json:"expires_at"`
	Password      string     `json:"password"`
	AllowDownload bool       `json:"allow_download"`
	AllowRemix    bool       `json:"allow_remix"`
	MaxViews      int64      `json:"max_views"` // 最大访问次数，0表示无限制
}
