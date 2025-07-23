package dao

import (
	"context"
	"time"

	"github.com/jun/fun_code/internal/model"
	"gorm.io/gorm"
)

// ExcalidrawDAOImpl 画板数据访问实现
type ExcalidrawDAOImpl struct {
	db *gorm.DB
}

// NewExcalidrawDAO 创建画板DAO实例
func NewExcalidrawDAO(db *gorm.DB) ExcalidrawDAO {
	return &ExcalidrawDAOImpl{db: db}
}

// Create 创建新画板
func (d *ExcalidrawDAOImpl) Create(ctx context.Context, board *model.ExcalidrawBoard) error {
	return d.db.WithContext(ctx).Create(board).Error
}

// GetByID 根据ID获取画板
func (d *ExcalidrawDAOImpl) GetByID(ctx context.Context, id uint) (*model.ExcalidrawBoard, error) {
	var board model.ExcalidrawBoard
	err := d.db.WithContext(ctx).
		Preload("User").
		Where("id = ? AND deleted_at IS NULL", id).
		First(&board).Error
	if err != nil {
		return nil, err
	}
	return &board, nil
}

// Update 更新画板
func (d *ExcalidrawDAOImpl) Update(ctx context.Context, board *model.ExcalidrawBoard) error {
	return d.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", board.ID).
		Updates(board).Error
}

// Delete 软删除画板
func (d *ExcalidrawDAOImpl) Delete(ctx context.Context, id uint) error {
	now := time.Now().Unix()
	return d.db.WithContext(ctx).
		Model(&model.ExcalidrawBoard{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", now).Error
}

// GetAllBoardsWithPagination 分页获取所有画板（参考ListProjectsWithPagination实现）
func (d *ExcalidrawDAOImpl) GetAllBoardsWithPagination(ctx context.Context, userID uint, pageSize uint, beginID uint, forward, asc bool) ([]*model.ExcalidrawBoard, bool, error) {
	var boards []*model.ExcalidrawBoard

	// 处理 pageSize 为 0 的情况，使用默认值 20
	if pageSize == 0 {
		pageSize = 20
	}

	// 构建基础查询
	query := d.db.WithContext(ctx).Where("deleted_at IS NULL")

	// 如果指定了用户ID，则只查询该用户的画板
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}

	// 分页逻辑：根据排序方向和翻页方向确定查询条件
	var needReverse bool = false
	if beginID > 0 {
		if asc {
			// 升序排列时：向前翻页获取更大的ID，向后翻页获取更小的ID
			if forward {
				query = query.Where("id > ?", beginID)
			} else {
				query = query.Where("id < ?", beginID)
				needReverse = true
			}
		} else {
			// 降序排列时：向前翻页获取更小的ID，向后翻页获取更大的ID
			if forward {
				query = query.Where("id < ?", beginID)
			} else {
				query = query.Where("id > ?", beginID)
				needReverse = true
			}
		}
	}

	// 排序逻辑：根据参数确定排序方向
	var orderClause string
	if asc {
		if needReverse {
			orderClause = "created_at DESC, id DESC"
		} else {
			orderClause = "created_at ASC, id ASC"
		}
	} else {
		if needReverse {
			orderClause = "created_at ASC, id ASC"
		} else {
			orderClause = "created_at DESC, id DESC"
		}
	}
	query = query.Order(orderClause)

	// 预加载关联数据并限制查询数量（多查一条用于判断是否还有更多数据）
	if err := query.Preload("User").Limit(int(pageSize + 1)).Find(&boards).Error; err != nil {
		return nil, false, err
	}

	// 判断是否有更多数据
	hasMore := len(boards) > int(pageSize)
	if hasMore {
		boards = boards[:pageSize]
	}

	// 如果是向上翻页，需要反转结果以保持正确的显示顺序
	if needReverse {
		for i, j := 0, len(boards)-1; i < j; i, j = i+1, j-1 {
			boards[i], boards[j] = boards[j], boards[i]
		}
	}

	return boards, hasMore, nil
}

// GetUserBoardCount 获取用户画板数量
func (d *ExcalidrawDAOImpl) GetUserBoardCount(ctx context.Context, userID uint) (int64, error) {
	var count int64
	query := d.db.WithContext(ctx).Model(&model.ExcalidrawBoard{}).Where("deleted_at IS NULL")

	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}

	err := query.Count(&count).Error
	return count, err
}

// BatchDelete 批量删除画板
func (d *ExcalidrawDAOImpl) BatchDelete(ctx context.Context, ids []uint) error {
	now := time.Now().Unix()
	return d.db.WithContext(ctx).
		Model(&model.ExcalidrawBoard{}).
		Where("id IN ? AND deleted_at IS NULL", ids).
		Update("deleted_at", now).Error
}
