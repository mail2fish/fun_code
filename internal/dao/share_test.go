package dao

import (
	"testing"
	"time"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/model"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB() *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	// 自动迁移
	db.AutoMigrate(&model.User{}, &model.ScratchProject{}, &model.Share{})

	// 创建测试数据
	user := &model.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password",
	}
	db.Create(user)

	project := &model.ScratchProject{
		UserID:   user.ID,
		Name:     "Test Project",
		MD5:      "test_md5",
		FilePath: "test/path",
	}
	db.Create(project)

	return db
}

func TestShareDao_CreateShare(t *testing.T) {
	db := setupTestDB()
	logger := zap.NewNop()
	cfg := &config.Config{}
	shareDao := NewShareDao(db, cfg, logger)

	req := &CreateShareRequest{
		ProjectID:     1,
		ProjectType:   model.ProjectTypeScratch,
		UserID:        1,
		Title:         "测试分享",
		Description:   "这是一个测试分享",
		MaxViews:      5, // 设置5次访问限制
		AllowDownload: true,
		AllowRemix:    true,
	}

	share, err := shareDao.CreateShare(req)
	assert.NoError(t, err)
	assert.NotNil(t, share)
	assert.Equal(t, "测试分享", share.Title)
	assert.Equal(t, int64(5), share.MaxViews)
	assert.Equal(t, int64(0), share.ViewCount)
	assert.True(t, share.IsActive)
	assert.NotEmpty(t, share.ShareToken)
}

func TestShareDao_ViewLimitReached(t *testing.T) {
	db := setupTestDB()
	logger := zap.NewNop()
	cfg := &config.Config{}
	shareDao := NewShareDao(db, cfg, logger)

	// 创建一个有访问限制的分享
	req := &CreateShareRequest{
		ProjectID:     1,
		ProjectType:   model.ProjectTypeScratch,
		UserID:        1,
		Title:         "限制访问分享",
		MaxViews:      3, // 只允许3次访问
		AllowDownload: false,
		AllowRemix:    false,
	}

	share, err := shareDao.CreateShare(req)
	assert.NoError(t, err)

	// 模拟3次访问
	for i := 0; i < 3; i++ {
		err = shareDao.RecordView(share.ID)
		if i < 2 {
			// 前两次访问应该成功
			assert.NoError(t, err)
		} else {
			// 第三次访问应该成功，但会自动关闭分享
			assert.NoError(t, err)
		}
	}

	// 验证分享已被自动关闭
	updatedShare, err := shareDao.GetShareByToken(share.ShareToken)
	assert.NoError(t, err)
	assert.False(t, updatedShare.IsActive) // 应该被自动关闭
	assert.Equal(t, int64(3), updatedShare.ViewCount)

	// 尝试第四次访问，应该失败
	err = shareDao.RecordView(share.ID)
	assert.Error(t, err)
}

func TestShareDao_GetShareStats(t *testing.T) {
	db := setupTestDB()
	logger := zap.NewNop()
	cfg := &config.Config{}
	shareDao := NewShareDao(db, cfg, logger)

	// 创建分享
	req := &CreateShareRequest{
		ProjectID:   1,
		ProjectType: model.ProjectTypeScratch,
		UserID:      1,
		Title:       "统计测试分享",
		MaxViews:    10,
		AllowRemix:  true,
	}

	share, err := shareDao.CreateShare(req)
	assert.NoError(t, err)

	// 记录几次访问
	for i := 0; i < 3; i++ {
		err = shareDao.RecordView(share.ID)
		assert.NoError(t, err)
	}

	// 获取统计信息
	stats, err := shareDao.GetShareStats(share.ID)
	assert.NoError(t, err)
	assert.Equal(t, int64(3), stats["current_views"])
	assert.Equal(t, int64(3), stats["total_views"])
	assert.Equal(t, int64(10), stats["max_views"])
	assert.Equal(t, int64(7), stats["remaining_views"])
	assert.False(t, stats["is_view_limit_reached"].(bool))
}

func TestShareDao_UpdateShare(t *testing.T) {
	db := setupTestDB()
	logger := zap.NewNop()
	cfg := &config.Config{}
	shareDao := NewShareDao(db, cfg, logger)

	// 创建分享
	req := &CreateShareRequest{
		ProjectID:   1,
		ProjectType: model.ProjectTypeScratch,
		UserID:      1,
		Title:       "原始标题",
		MaxViews:    5,
		AllowRemix:  false,
	}

	share, err := shareDao.CreateShare(req)
	assert.NoError(t, err)

	// 更新分享
	updates := map[string]interface{}{
		"title":     "更新后的标题",
		"max_views": 20,
	}

	err = shareDao.UpdateShare(share.ID, 1, updates)
	assert.NoError(t, err)

	// 验证更新
	updatedShare, err := shareDao.GetShareByToken(share.ShareToken)
	assert.NoError(t, err)
	assert.Equal(t, "更新后的标题", updatedShare.Title)
	assert.Equal(t, int64(20), updatedShare.MaxViews)
}

func TestShareDao_DeleteShare(t *testing.T) {
	db := setupTestDB()
	logger := zap.NewNop()
	cfg := &config.Config{}
	shareDao := NewShareDao(db, cfg, logger)

	// 创建分享
	req := &CreateShareRequest{
		ProjectID:   1,
		ProjectType: model.ProjectTypeScratch,
		UserID:      1,
		Title:       "待删除分享",
		MaxViews:    5,
		AllowRemix:  false,
	}

	share, err := shareDao.CreateShare(req)
	assert.NoError(t, err)
	assert.True(t, share.IsActive)

	// 删除分享
	err = shareDao.DeleteShare(share.ID, 1)
	assert.NoError(t, err)

	// 验证分享已被软删除
	deletedShare, err := shareDao.GetShareByToken(share.ShareToken)
	assert.NoError(t, err)
	assert.False(t, deletedShare.IsActive)
}

func TestShareDao_CheckShareAccess(t *testing.T) {
	db := setupTestDB()
	logger := zap.NewNop()
	cfg := &config.Config{}
	shareDao := NewShareDao(db, cfg, logger)

	// 测试正常分享
	normalShare := &model.Share{
		IsActive:  true,
		ViewCount: 2,
		MaxViews:  5,
		ExpiresAt: nil,
	}
	err := shareDao.CheckShareAccess(normalShare)
	assert.NoError(t, err)

	// 测试已禁用的分享
	inactiveShare := &model.Share{
		IsActive:  false,
		ViewCount: 2,
		MaxViews:  5,
		ExpiresAt: nil,
	}
	err = shareDao.CheckShareAccess(inactiveShare)
	assert.Error(t, err)

	// 测试已过期的分享
	expiredTime := time.Now().Add(-1 * time.Hour)
	expiredShare := &model.Share{
		IsActive:  true,
		ViewCount: 2,
		MaxViews:  5,
		ExpiresAt: &expiredTime,
	}
	err = shareDao.CheckShareAccess(expiredShare)
	assert.Error(t, err)

	// 测试达到访问限制的分享
	limitReachedShare := &model.Share{
		ID:        1,
		IsActive:  true,
		ViewCount: 5,
		MaxViews:  5,
		ExpiresAt: nil,
	}
	// 需要先在数据库中创建这个分享记录
	db.Create(limitReachedShare)
	err = shareDao.CheckShareAccess(limitReachedShare)
	assert.Error(t, err)
}

func TestShareDao_ReshareProject(t *testing.T) {
	db := setupTestDB()
	logger := zap.NewNop()
	cfg := &config.Config{}
	shareDao := NewShareDao(db, cfg, logger)

	// 创建分享
	req := &CreateShareRequest{
		ProjectID:   1,
		ProjectType: model.ProjectTypeScratch,
		UserID:      1,
		Title:       "重新分享测试",
		MaxViews:    3,
		AllowRemix:  true,
	}

	share, err := shareDao.CreateShare(req)
	assert.NoError(t, err)

	// 访问到达限制
	for i := 0; i < 3; i++ {
		err = shareDao.RecordView(share.ID)
		assert.NoError(t, err)
	}

	// 验证分享已关闭
	updatedShare, err := shareDao.GetShareByToken(share.ShareToken)
	assert.NoError(t, err)
	assert.False(t, updatedShare.IsActive)
	assert.Equal(t, int64(3), updatedShare.ViewCount)
	assert.Equal(t, int64(3), updatedShare.TotalViewCount)

	// 重新分享
	err = shareDao.ReshareProject(share.ID, 1)
	assert.NoError(t, err)

	// 验证分享已重新激活，当前访问次数重置，总访问次数保持
	resharedShare, err := shareDao.GetShareByToken(share.ShareToken)
	assert.NoError(t, err)
	assert.True(t, resharedShare.IsActive)
	assert.Equal(t, int64(0), resharedShare.ViewCount)      // 当前访问次数重置
	assert.Equal(t, int64(3), resharedShare.TotalViewCount) // 总访问次数保持

	// 可以再次访问
	err = shareDao.RecordView(share.ID)
	assert.NoError(t, err)

	// 验证计数正确
	finalShare, err := shareDao.GetShareByToken(share.ShareToken)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), finalShare.ViewCount)      // 当前访问次数为1
	assert.Equal(t, int64(4), finalShare.TotalViewCount) // 总访问次数为4
}

func TestShareDao_AllowRemix(t *testing.T) {
	db := setupTestDB()
	logger := zap.NewNop()
	cfg := &config.Config{}
	shareDao := NewShareDao(db, cfg, logger)

	// 创建允许Remix的分享
	req := &CreateShareRequest{
		ProjectID:   1,
		ProjectType: model.ProjectTypeScratch,
		UserID:      1,
		Title:       "允许Remix测试",
		MaxViews:    10,
		AllowRemix:  true,
	}

	share, err := shareDao.CreateShare(req)
	assert.NoError(t, err)
	assert.True(t, share.AllowRemix)

	// 创建不允许Remix的分享
	req2 := &CreateShareRequest{
		ProjectID:   1,
		ProjectType: model.ProjectTypeScratch,
		UserID:      1,
		Title:       "不允许Remix测试",
		MaxViews:    10,
		AllowRemix:  false,
	}

	share2, err := shareDao.CreateShare(req2)
	assert.NoError(t, err)
	assert.False(t, share2.AllowRemix)

	// 更新分享的Remix权限
	updates := map[string]interface{}{
		"allow_remix": true,
	}

	err = shareDao.UpdateShare(share2.ID, 1, updates)
	assert.NoError(t, err)

	// 验证更新
	updatedShare, err := shareDao.GetShareByToken(share2.ShareToken)
	assert.NoError(t, err)
	assert.True(t, updatedShare.AllowRemix)
}
