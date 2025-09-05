package dao

import (
	"context"

	"github.com/jun/fun_code/internal/model"
)

// ExcalidrawDAO 画板数据访问接口
type ExcalidrawDAO interface {
	// 基础CRUD操作
	Create(ctx context.Context, board *model.ExcalidrawBoard) error
	GetByID(ctx context.Context, id uint) (*model.ExcalidrawBoard, string, error)
	ReadBoard(ctx context.Context, board *model.ExcalidrawBoard) (string, error)
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

	// 搜索画板（按名称）
	// userID=0时搜索所有用户的画板，userID>0时搜索指定用户的画板
	// keyword为搜索关键词，进行名称模糊搜索
	// 返回值：画板列表、错误
	SearchBoardsByName(ctx context.Context, userID uint, keyword string) ([]*model.ExcalidrawBoard, error)

	// 批量操作
	BatchDelete(ctx context.Context, ids []uint) error

	// 文件保存操作
	// SaveExcalidrawFile 保存Excalidraw文件
	// boardID: 画板ID，如果是0表示新建，否则表示更新
	// existingFilePath: 现有的文件路径，用于更新时保持目录不变
	SaveExcalidrawFile(userID uint, boardID uint, existingFilePath string, content []byte) (string, error)

	// SaveExcalidrawThumb 保存Excalidraw缩略图文件（PNG格式）
	// boardID: 画板ID
	// relativeFilePath: 相对文件路径
	// content: PNG文件内容
	SaveExcalidrawThumb(userID uint, boardID uint, relativeFilePath string, content []byte) error

	// GetExcalidrawThumb 获取Excalidraw缩略图文件（PNG格式）
	// boardID: 画板ID
	// relativeFilePath: 相对文件路径
	// 返回: PNG文件内容和错误信息
	GetExcalidrawThumb(boardID uint, relativeFilePath string) ([]byte, error)
}
