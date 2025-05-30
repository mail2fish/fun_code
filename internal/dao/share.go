package dao

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ShareDaoImpl 实现了ShareDao接口
type ShareDaoImpl struct {
	db     *gorm.DB
	cfg    *config.Config
	logger *zap.Logger
}

// NewShareDao 创建一个新的ShareDao实例
func NewShareDao(db *gorm.DB, cfg *config.Config, logger *zap.Logger) ShareDao {
	return &ShareDaoImpl{
		db:     db,
		cfg:    cfg,
		logger: logger,
	}
}

// CreateShare 创建分享链接
func (s *ShareDaoImpl) CreateShare(req *CreateShareRequest) (*model.Share, error) {
	// 验证项目是否存在
	var project model.ScratchProject
	if err := s.db.First(&project, req.ProjectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeProjectNotFound, global.ErrorMsgProjectNotFound, err)
		}
		return nil, err
	}

	// 验证用户是否存在
	var user model.User
	if err := s.db.First(&user, req.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeUserNotFound, global.ErrorMsgUserNotFound, err)
		}
		return nil, err
	}

	// 生成唯一的分享token
	shareToken, err := s.generateShareToken()
	if err != nil {
		return nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeTokenGenerationFailed, global.ErrorMsgTokenGenerationFailed, err)
	}

	// 设置默认访问次数限制
	maxViews := req.MaxViews
	if maxViews == 0 {
		maxViews = 10 // 默认10次访问限制
	}

	// 创建分享记录
	share := &model.Share{
		ShareToken:    shareToken,
		ProjectID:     req.ProjectID,
		ProjectType:   req.ProjectType,
		UserID:        req.UserID,
		Title:         req.Title,
		Description:   req.Description,
		ExpiresAt:     req.ExpiresAt,
		Password:      req.Password,
		AllowDownload: req.AllowDownload,
		AllowRemix:    req.AllowRemix,
		MaxViews:      maxViews,
		IsActive:      true,
		ViewCount:     0,
	}

	if err := s.db.Create(share).Error; err != nil {
		return nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareCreateFailed, global.ErrorMsgShareCreateFailed, err)
	}

	s.logger.Info("分享链接创建成功",
		zap.Uint("share_id", share.ID),
		zap.String("share_token", share.ShareToken),
		zap.Uint("project_id", req.ProjectID),
		zap.Uint("user_id", req.UserID),
		zap.Int64("max_views", maxViews))

	return share, nil
}

// GetShareByToken 通过token获取分享信息
func (s *ShareDaoImpl) GetShareByToken(token string) (*model.Share, error) {
	var share model.Share
	err := s.db.Preload("ScratchProject").Preload("User").
		Where("share_token = ?", token).First(&share).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareNotFound, global.ErrorMsgShareNotFound, err)
		}
		return nil, err
	}

	return &share, nil
}

// CheckShareAccess 检查分享是否可访问（包括访问次数限制）
func (s *ShareDaoImpl) CheckShareAccess(share *model.Share) error {
	if !share.IsActive {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareInactive, global.ErrorMsgShareInactive, nil)
	}

	if share.IsExpired() {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareExpired, global.ErrorMsgShareExpired, nil)
	}

	if share.IsViewLimitReached() {
		// 自动关闭分享
		s.db.Model(share).Update("is_active", false)
		s.logger.Info("分享链接因达到访问次数限制而自动关闭",
			zap.Uint("share_id", share.ID),
			zap.Int64("view_count", share.ViewCount),
			zap.Int64("max_views", share.MaxViews))
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeViewLimitReached, global.ErrorMsgViewLimitReached, nil)
	}

	return nil
}

// RecordView 记录访问并检查访问限制
func (s *ShareDaoImpl) RecordView(shareID uint) error {
	// 获取分享信息
	var share model.Share
	if err := s.db.First(&share, shareID).Error; err != nil {
		return gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareNotFound, global.ErrorMsgShareNotFound, err)
	}

	// 检查访问权限（在记录访问前检查）
	if err := s.CheckShareAccess(&share); err != nil {
		return err
	}

	// 使用事务确保数据一致性
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 增加访问次数和总访问次数
		if err := tx.Model(&model.Share{}).Where("id = ?", shareID).
			Updates(map[string]interface{}{
				"view_count":       gorm.Expr("view_count + 1"),
				"total_view_count": gorm.Expr("total_view_count + 1"),
			}).Error; err != nil {
			return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeViewRecordFailed, global.ErrorMsgViewRecordFailed, err)
		}

		// 重新获取更新后的分享信息，检查是否需要自动关闭
		var updatedShare model.Share
		if err := tx.First(&updatedShare, shareID).Error; err != nil {
			return err
		}

		// 如果达到访问次数限制，自动关闭分享
		if updatedShare.IsViewLimitReached() {
			if err := tx.Model(&model.Share{}).Where("id = ?", shareID).
				Update("is_active", false).Error; err != nil {
				return err
			}
			s.logger.Info("分享链接因达到访问次数限制而自动关闭",
				zap.Uint("share_id", shareID),
				zap.Int64("view_count", updatedShare.ViewCount),
				zap.Int64("max_views", updatedShare.MaxViews))
		}

		return nil
	})
}

// ReshareProject 重新分享项目（重置访问计数）
func (s *ShareDaoImpl) ReshareProject(shareID uint, userID uint) error {
	result := s.db.Model(&model.Share{}).
		Where("id = ? AND user_id = ?", shareID, userID).
		Updates(map[string]interface{}{
			"view_count": 0,
			"is_active":  true,
		})

	if result.Error != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareUpdateFailed, global.ErrorMsgShareUpdateFailed, result.Error)
	}

	if result.RowsAffected == 0 {
		return gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareNotFound, global.ErrorMsgShareNotFound, nil)
	}

	s.logger.Info("项目重新分享成功",
		zap.Uint("share_id", shareID),
		zap.Uint("user_id", userID))

	return nil
}

// GetUserShares 获取用户的分享列表
func (s *ShareDaoImpl) GetUserShares(userID uint, page, pageSize int) ([]model.Share, int64, error) {
	var shares []model.Share
	var total int64

	offset := (page - 1) * pageSize

	// 获取总数
	if err := s.db.Model(&model.Share{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	err := s.db.Preload("ScratchProject").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&shares).Error

	return shares, total, err
}

// UpdateShare 更新分享信息
func (s *ShareDaoImpl) UpdateShare(shareID uint, userID uint, updates map[string]interface{}) error {
	result := s.db.Model(&model.Share{}).
		Where("id = ? AND user_id = ?", shareID, userID).
		Updates(updates)

	if result.Error != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareUpdateFailed, global.ErrorMsgShareUpdateFailed, result.Error)
	}

	if result.RowsAffected == 0 {
		return gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareNotFound, global.ErrorMsgShareNotFound, nil)
	}

	s.logger.Info("分享信息更新成功",
		zap.Uint("share_id", shareID),
		zap.Uint("user_id", userID))

	return nil
}

// DeleteShare 删除分享（软删除，设置为不活跃）
func (s *ShareDaoImpl) DeleteShare(shareID uint, userID uint) error {
	result := s.db.Model(&model.Share{}).
		Where("id = ? AND user_id = ?", shareID, userID).
		Update("is_active", false)

	if result.Error != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareDeleteFailed, global.ErrorMsgShareDeleteFailed, result.Error)
	}

	if result.RowsAffected == 0 {
		return gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareNotFound, global.ErrorMsgShareNotFound, nil)
	}

	s.logger.Info("分享删除成功",
		zap.Uint("share_id", shareID),
		zap.Uint("user_id", userID))

	return nil
}

// GetShareStats 获取分享统计信息
func (s *ShareDaoImpl) GetShareStats(shareID uint) (map[string]interface{}, error) {
	var share model.Share
	if err := s.db.First(&share, shareID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareNotFound, global.ErrorMsgShareNotFound, err)
		}
		return nil, err
	}

	remainingViews := int64(0)
	if share.MaxViews > 0 {
		remainingViews = share.MaxViews - share.ViewCount
		if remainingViews < 0 {
			remainingViews = 0
		}
	}

	return map[string]interface{}{
		"current_views":         share.ViewCount,
		"total_views":           share.TotalViewCount,
		"max_views":             share.MaxViews,
		"remaining_views":       remainingViews,
		"created_at":            share.CreatedAt,
		"is_active":             share.IsActive,
		"expires_at":            share.ExpiresAt,
		"is_view_limit_reached": share.IsViewLimitReached(),
	}, nil
}

// generateShareToken 生成唯一的分享token
func (s *ShareDaoImpl) generateShareToken() (string, error) {
	for i := 0; i < 10; i++ { // 最多尝试10次
		bytes := make([]byte, 16)
		if _, err := rand.Read(bytes); err != nil {
			return "", err
		}
		token := hex.EncodeToString(bytes)

		// 检查token是否已存在
		var count int64
		s.db.Model(&model.Share{}).Where("share_token = ?", token).Count(&count)
		if count == 0 {
			return token, nil
		}
	}
	return "", errors.New("生成唯一token失败")
}
