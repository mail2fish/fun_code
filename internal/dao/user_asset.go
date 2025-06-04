package dao

import (
	"net/http"

	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"gorm.io/gorm"
)

type UserAssetDao interface {
	CreateUserAsset(userAsset *model.UserAsset) error
	DeleteUserAsset(id uint) error
	ListUserAssetsWithPagination(userID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.UserAsset, bool, error)
}

type UserAssetDaoImpl struct {
	db *gorm.DB
}

func NewUserAssetDao(db *gorm.DB) UserAssetDao {
	return &UserAssetDaoImpl{
		db: db,
	}
}

func (d *UserAssetDaoImpl) CreateUserAsset(userAsset *model.UserAsset) error {
	err := d.db.Create(userAsset).Error
	if err != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_USER_ASSET, global.ErrorCodeInsertFailed, global.ErrorMsgInsertFailed, err)
	}
	return nil
}

func (d *UserAssetDaoImpl) DeleteUserAsset(id uint) error {
	err := d.db.Delete(&model.UserAsset{}, id).Error
	if err != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_USER_ASSET, global.ErrorCodeDeleteFailed, global.ErrorMsgDeleteFailed, err)
	}
	return nil
}

// ListUserAssetsWithPagination 分页列出用户的所有资源
// 参数：
// userID 为 uint 类型，代表用户ID
// pageSize 为 uint 类型，代表每页的资源数量
// beginID 为 uint 类型，代表分页的起始ID
// forward 为 bool 类型，代表是否向前分页
// asc 为 bool 类型，代表返回结果是否按升序排序
// 返回值：
// []model.UserAsset 类型，代表分页后的资源列表
// bool 类型，代表是否还有更多资源
// error 类型，代表错误信息
func (d *UserAssetDaoImpl) ListUserAssetsWithPagination(userID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.UserAsset, bool, error) {
	var assets []model.UserAsset

	// 处理 pageSize 为 0 的情况，使用默认值 20
	if pageSize == 0 {
		pageSize = 20
	}

	// 构建基础查询
	query := d.db

	// 如果指定了用户ID，则只查询该用户的资源
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}

	// 记录查询是否按升序排序
	queryAsc := false

	// 根据 beginID、forward 和 asc 设置查询条件和排序
	if beginID > 0 {
		if asc && forward {
			// asc == true and forward == true
			// id >= beginID, order 为 id asc
			query = query.Where("id > ?", beginID).Order("id ASC")
			queryAsc = true
		} else if asc && !forward {
			// asc == true and forward == false
			// id <= beginID，order 为 id desc
			query = query.Where("id < ?", beginID).Order("id DESC")
			queryAsc = false
		} else if !asc && forward {
			// asc == false and forward == true
			// id <= beginID，order 为 id desc
			query = query.Where("id < ?", beginID).Order("id DESC")
			queryAsc = false
		} else {
			// asc == false and forward == false
			// id >= beginID, order 为 id asc
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
	if err := query.Limit(int(pageSize + 1)).Find(&assets).Error; err != nil {
		return nil, false, gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_USER_ASSET, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 处理查询结果
	// asc 为 true 时，返回结果数组按 id 升序排序，代表页面按升序显示
	// asc 为 false 时，返回结果数组按 id 降序排序，代表页面按降序显示
	hasMore := len(assets) > int(pageSize)
	if hasMore {
		assets = assets[:pageSize]
	}

	// 检查查询结果的排序是否与 asc 参数一致，如果不一致则需要反转
	if queryAsc != asc {
		for i, j := 0, len(assets)-1; i < j; i, j = i+1, j-1 {
			assets[i], assets[j] = assets[j], assets[i]
		}
	}

	return assets, hasMore, nil
}
