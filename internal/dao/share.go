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
		LikeCount:     0,
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
			return nil, ErrShareNotFound
		}
		return nil, err
	}

	return &share, nil
}

var ErrShareNotFound = gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareNotFound, global.ErrorMsgShareNotFound, nil)

// GetShareByProject 通过项目ID和用户ID获取分享信息
func (s *ShareDaoImpl) GetShareByProject(projectID uint, userID uint) (*model.Share, error) {
	var share model.Share
	err := s.db.Preload("ScratchProject").Preload("User").
		Where("project_id = ? AND user_id = ?", projectID, userID).First(&share).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareNotFound
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
		return ErrShareNotFound
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

// GetUserShares 获取用户的分享列表（游标分页）
// 参数：
// userID 为 uint 类型，代表用户ID
// pageSize 为 uint 类型，代表每页的分享数量
// beginID 为 uint 类型，代表分页的起始ID
// forward 为 bool 类型，代表是否向前分页
// asc 为 bool 类型，代表返回结果是否按ID升序排序
// 返回值：
// []model.Share 类型，代表分页后的分享列表
// bool 类型，代表是否还有更多分享
// error 类型，代表错误信息
func (s *ShareDaoImpl) GetUserShares(userID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Share, bool, error) {
	var shares []model.Share

	// 处理 pageSize 为 0 的情况，使用默认值 20
	if pageSize == 0 {
		pageSize = 20
	}

	// 构建基础查询
	query := s.db.Preload("ScratchProject").Where("user_id = ?", userID)

	// 记录查询是否按升序排序
	queryAsc := false

	// 根据 beginID、forward 和 asc 设置查询条件和排序
	if beginID > 0 {
		if asc && forward {
			// asc == true and forward == true
			// id > beginID, order 为 id asc
			query = query.Where("id > ?", beginID).Order("id ASC")
			queryAsc = true
		} else if asc && !forward {
			// asc == true and forward == false
			// id < beginID，order 为 id desc
			query = query.Where("id < ?", beginID).Order("id DESC")
			queryAsc = false
		} else if !asc && forward {
			// asc == false and forward == true
			// id < beginID，order 为 id desc
			query = query.Where("id < ?", beginID).Order("id DESC")
			queryAsc = false
		} else {
			// asc == false and forward == false
			// id > beginID, order 为 id asc
			query = query.Where("id > ?", beginID).Order("id ASC")
			queryAsc = true
		}
	} else {
		// beginID 为 0 的情况
		if asc {
			// asc 为 true，按 id asc 排序
			query = query.Order("id ASC")
			queryAsc = true
		} else {
			// asc 为 false，按 id desc 排序
			query = query.Order("id DESC")
			queryAsc = false
		}
	}

	// 执行查询，多查询一条用于判断是否有更多数据
	if err := query.Limit(int(pageSize + 1)).Find(&shares).Error; err != nil {
		return nil, false, gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 处理查询结果
	hasMore := len(shares) > int(pageSize)
	if hasMore {
		shares = shares[:pageSize] // 移除多余的一条记录
	}

	// 如果查询时使用了降序，但用户期望升序结果，则需要反转
	if queryAsc != asc {
		for i, j := 0, len(shares)-1; i < j; i, j = i+1, j-1 {
			shares[i], shares[j] = shares[j], shares[i]
		}
	}

	return shares, hasMore, nil
}

// GetAllShares 获取所有分享列表（游标分页）
// 参数：
// pageSize 为 uint 类型，代表每页的分享数量
// beginID 为 uint 类型，代表分页的起始ID
// forward 为 bool 类型，代表是否向前分页
// asc 为 bool 类型，代表返回结果是否按ID升序排序
// 返回值：
// []model.Share 类型，代表分页后的分享列表
// bool 类型，代表是否还有更多分享
// error 类型，代表错误信息
func (s *ShareDaoImpl) GetAllShares(pageSize uint, beginID uint, forward, asc bool) ([]model.Share, bool, error) {
	var shares []model.Share

	// 处理 pageSize 为 0 的情况，使用默认值 20
	if pageSize == 0 {
		pageSize = 20
	}

	// 构建基础查询（不过滤用户，获取所有分享，同时预加载项目和用户信息）
	query := s.db.Preload("ScratchProject").Preload("User")

	// 记录查询是否按升序排序
	queryAsc := false

	// 根据 beginID、forward 和 asc 设置查询条件和排序
	if beginID > 0 {
		if asc && forward {
			// asc == true and forward == true
			// id > beginID, order 为 id asc
			query = query.Where("id > ?", beginID).Order("id ASC")
			queryAsc = true
		} else if asc && !forward {
			// asc == true and forward == false
			// id < beginID，order 为 id desc
			query = query.Where("id < ?", beginID).Order("id DESC")
			queryAsc = false
		} else if !asc && forward {
			// asc == false and forward == true
			// id < beginID，order 为 id desc
			query = query.Where("id < ?", beginID).Order("id DESC")
			queryAsc = false
		} else {
			// asc == false and forward == false
			// id > beginID, order 为 id asc
			query = query.Where("id > ?", beginID).Order("id ASC")
			queryAsc = true
		}
	} else {
		// beginID 为 0 的情况
		if asc {
			// asc 为 true，按 id asc 排序
			query = query.Order("id ASC")
			queryAsc = true
		} else {
			// asc 为 false，按 id desc 排序
			query = query.Order("id DESC")
			queryAsc = false
		}
	}

	// 执行查询，多查询一条用于判断是否有更多数据
	if err := query.Limit(int(pageSize + 1)).Find(&shares).Error; err != nil {
		return nil, false, gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 处理查询结果
	hasMore := len(shares) > int(pageSize)
	if hasMore {
		shares = shares[:pageSize] // 移除多余的一条记录
	}

	// 如果查询时使用了降序，但用户期望升序结果，则需要反转
	if queryAsc != asc {
		for i, j := 0, len(shares)-1; i < j; i, j = i+1, j-1 {
			shares[i], shares[j] = shares[j], shares[i]
		}
	}

	return shares, hasMore, nil
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

// DeleteShare 删除分享（软删除或彻底删除）
func (s *ShareDaoImpl) DeleteShare(shareID uint, userID uint) error {
	// 先查询分享记录
	var share model.Share
	if err := s.db.Where("id = ? AND user_id = ?", shareID, userID).First(&share).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareNotFound, global.ErrorMsgShareNotFound, nil)
		}
		return err
	}

	// 如果已经是软删除状态，则彻底删除
	if !share.IsActive {
		if err := s.db.Delete(&share).Error; err != nil {
			return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareDeleteFailed, global.ErrorMsgShareDeleteFailed, err)
		}
		s.logger.Info("分享彻底删除成功",
			zap.Uint("share_id", shareID),
			zap.Uint("user_id", userID))
		return nil
	}

	// 否则进行软删除
	result := s.db.Model(&model.Share{}).
		Where("id = ? AND user_id = ?", shareID, userID).
		Update("is_active", false)

	if result.Error != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_SHARE, global.ErrorCodeShareDeleteFailed, global.ErrorMsgShareDeleteFailed, result.Error)
	}

	s.logger.Info("分享软删除成功",
		zap.Uint("share_id", shareID),
		zap.Uint("user_id", userID))

	return nil
}

// GetShareStats 获取分享统计信息
func (s *ShareDaoImpl) GetShareStats(shareID uint) (map[string]interface{}, error) {
	var share model.Share
	if err := s.db.First(&share, shareID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareNotFound
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
		bytes := make([]byte, 4)
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

func (s *ShareDaoImpl) IsShareProject(projectID uint) bool {
	var share model.Share
	if err := s.db.Where("project_id = ?", projectID).First(&share).Error; err != nil {
		return false
	}
	return share.IsActive
}
