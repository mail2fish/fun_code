package dao

import (
	"context"

	"github.com/jun/fun_code/internal/model"
)

// ExcalidrawDAO 画板数据访问接口
type ExcalidrawDAO interface {
	// 基础CRUD操作
	Create(ctx context.Context, board *model.ExcalidrawBoard) error
	GetByID(ctx context.Context, id uint) (*model.ExcalidrawBoard, error)
	Update(ctx context.Context, board *model.ExcalidrawBoard) error
	Delete(ctx context.Context, id uint) error // 软删除

	// 分页获取所有画板（Admin/Teacher）
	// userID=0时返回所有用户的画板，userID>0时返回指定用户的画板
	// pageSize为0时使用默认值20
	// beginID为分页起始ID，forward为翻页方向，asc为排序方向
	// 返回值：画板列表、是否还有更多、错误
	GetAllBoardsWithPagination(ctx context.Context, userID uint, pageSize uint, beginID uint, forward, asc bool) ([]*model.ExcalidrawBoard, bool, error)

	// 统计查询
	// userID=0时返回所有用户的画板数量，userID>0时返回指定用户的画板数量
	GetUserBoardCount(ctx context.Context, userID uint) (int64, error)

	// 批量操作
	BatchDelete(ctx context.Context, ids []uint) error
}
