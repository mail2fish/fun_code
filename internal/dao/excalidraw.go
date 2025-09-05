package dao

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/model"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	// ExcalidrawHistoryFileLimit 保留的历史文件数量
	ExcalidrawHistoryFileLimit = 10
)

// ExcalidrawDAOImpl 画板数据访问实现
type ExcalidrawDAOImpl struct {
	db       *gorm.DB
	basePath string // 文件存储的基础路径
	cfg      *config.Config
	logger   *zap.Logger
}

// NewExcalidrawDAO 创建画板DAO实例
func NewExcalidrawDAO(db *gorm.DB, basePath string, cfg *config.Config, logger *zap.Logger) ExcalidrawDAO {
	return &ExcalidrawDAOImpl{
		db:       db,
		basePath: basePath,
		cfg:      cfg,
		logger:   logger,
	}
}

// Create 创建新画板
func (d *ExcalidrawDAOImpl) Create(ctx context.Context, board *model.ExcalidrawBoard) error {
	return d.db.WithContext(ctx).Create(board).Error
}

// GetByID 根据ID获取画板
func (d *ExcalidrawDAOImpl) GetByID(ctx context.Context, id uint) (*model.ExcalidrawBoard, string, error) {
	var board model.ExcalidrawBoard
	err := d.db.WithContext(ctx).
		Preload("User").
		Where("id = ? AND deleted_at IS NULL", id).
		First(&board).Error
	if err != nil {
		return nil, "", err
	}
	b, err := d.ReadBoard(ctx, &board)
	if err != nil {
		return nil, "", err
	}
	return &board, b, nil
}

func (d *ExcalidrawDAOImpl) ReadBoard(ctx context.Context, board *model.ExcalidrawBoard) (string, error) {
	filename := fmt.Sprintf("%d_%s.json", board.ID, board.MD5)
	filePath := filepath.Join(d.basePath, board.FilePath, filename)

	fmt.Println("filePath", filePath)
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// Update 更新画板
func (d *ExcalidrawDAOImpl) Update(ctx context.Context, board *model.ExcalidrawBoard) error {
	// 不需要手动设置 UpdatedAt，BeforeUpdate 钩子会自动处理
	// 使用 Select 明确指定要更新的字段，确保 MD5 能被正确更新
	return d.db.WithContext(ctx).
		Model(board).
		Where("id = ? AND deleted_at IS NULL", board.ID).
		Select("md5", "name", "updated_at").
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
			orderClause = "id DESC"
		} else {
			orderClause = "id ASC"
		}
	} else {
		if needReverse {
			orderClause = "id ASC"
		} else {
			orderClause = "id DESC"
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

// SearchBoardsByName 搜索画板（按名称）
func (d *ExcalidrawDAOImpl) SearchBoardsByName(ctx context.Context, userID uint, keyword string) ([]*model.ExcalidrawBoard, error) {
	var boards []*model.ExcalidrawBoard

	// 构建基础查询
	query := d.db.WithContext(ctx).Where("deleted_at IS NULL")

	// 如果指定了用户ID，则只查询该用户的画板
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}

	// 按名称模糊搜索
	query = query.Where("name LIKE ?", "%"+keyword+"%")

	// 查询数据
	if err := query.Preload("User").
		Order("id DESC").
		Find(&boards).Error; err != nil {
		return nil, err
	}

	return boards, nil
}

// BatchDelete 批量删除画板
func (d *ExcalidrawDAOImpl) BatchDelete(ctx context.Context, ids []uint) error {
	now := time.Now().Unix()
	return d.db.WithContext(ctx).
		Model(&model.ExcalidrawBoard{}).
		Where("id IN ? AND deleted_at IS NULL", ids).
		Update("deleted_at", now).Error
}

// SaveExcalidrawFile 保存Excalidraw文件，参考 SaveProject 的逻辑
// 文件保存路径基于第一次创建时的日期，根据当前年月日分成多级目录
// boardID: 画板ID，如果是0表示新建，否则表示更新
// existingFilePath: 现有的文件路径，用于更新时保持目录不变
func (d *ExcalidrawDAOImpl) SaveExcalidrawFile(userID uint, boardID uint, relativeFilePath string, content []byte) (string, error) {
	// 计算MD5
	hash := md5.Sum(content)
	md5Hash := hex.EncodeToString(hash[:])

	dirPath := filepath.Join(d.basePath, relativeFilePath)

	// 判断目录是否存在
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		// 创建目录
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			return "", fmt.Errorf("创建目录失败: %w", err)
		}
	}

	// 使用画板ID和MD5生成文件名
	fileName := fmt.Sprintf("%d_%s.json", boardID, md5Hash)
	fullFilePath := filepath.Join(dirPath, fileName)

	// 如果文件不存在，则写入
	if _, err := os.Stat(fullFilePath); err != nil {
		// 写入文件
		if err := os.WriteFile(fullFilePath, content, 0644); err != nil {
			d.logger.Error("写入文件失败", zap.Error(err))
			return "", fmt.Errorf("写入文件失败: %w", err)
		}
	}

	// 如果是更新操作，清理历史文件
	if boardID > 0 {
		go d.deleteExcalidrawHistoryFiles(boardID, dirPath)
	}

	return md5Hash, nil
}

// SaveExcalidrawThumb 保存Excalidraw缩略图文件，参考 SaveExcalidrawFile 的逻辑
// boardID: 画板ID
// relativeFilePath: 相对文件路径
// content: PNG文件内容
func (d *ExcalidrawDAOImpl) SaveExcalidrawThumb(userID uint, boardID uint, relativeFilePath string, content []byte) error {
	dirPath := filepath.Join(d.basePath, relativeFilePath)

	// 判断目录是否存在
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		// 创建目录
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			return fmt.Errorf("创建目录失败: %w", err)
		}
	}

	// 使用画板ID生成固定的缩略图文件名
	fileName := fmt.Sprintf("%d_thumbnail.png", boardID)
	fullFilePath := filepath.Join(dirPath, fileName)

	// 写入文件（允许覆盖现有文件）
	if err := os.WriteFile(fullFilePath, content, 0644); err != nil {
		d.logger.Error("写入缩略图文件失败", zap.Error(err))
		return fmt.Errorf("写入缩略图文件失败: %w", err)
	}

	return nil
}

// GetExcalidrawThumb 获取Excalidraw缩略图文件（PNG格式）
// boardID: 画板ID
// relativeFilePath: 相对文件路径
func (d *ExcalidrawDAOImpl) GetExcalidrawThumb(boardID uint, relativeFilePath string) ([]byte, error) {
	dirPath := filepath.Join(d.basePath, relativeFilePath)

	// 生成缩略图文件名
	fileName := fmt.Sprintf("%d_thumbnail.png", boardID)
	fullFilePath := filepath.Join(dirPath, fileName)

	// 读取文件内容
	content, err := os.ReadFile(fullFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("缩略图文件不存在: %w", err)
		}
		return nil, fmt.Errorf("读取缩略图文件失败: %w", err)
	}

	return content, nil
}

// deleteExcalidrawHistoryFiles 删除超出配置限制的历史文件
func (d *ExcalidrawDAOImpl) deleteExcalidrawHistoryFiles(boardID uint, dirPath string) {
	// 查找所有属于该画板的文件
	files, err := os.ReadDir(dirPath)
	if err != nil {
		fmt.Printf("读取目录失败: %v\n", err)
		return
	}

	// 过滤出属于该画板的文件
	var boardFiles []os.DirEntry
	boardIDStr := fmt.Sprintf("%d_", boardID)
	for _, file := range files {
		if !file.IsDir() && strings.HasPrefix(file.Name(), boardIDStr) && strings.HasSuffix(file.Name(), ".json") {
			boardFiles = append(boardFiles, file)
		}
	}

	// 如果文件数量不超过限制，不需要删除
	if len(boardFiles) <= ExcalidrawHistoryFileLimit {
		return
	}

	// 按文件修改时间排序（最新的在前）
	sort.Slice(boardFiles, func(i, j int) bool {
		infoI, errI := boardFiles[i].Info()
		infoJ, errJ := boardFiles[j].Info()
		if errI != nil || errJ != nil {
			return false
		}
		return infoI.ModTime().After(infoJ.ModTime())
	})

	// 删除超出限制的文件
	for i := ExcalidrawHistoryFileLimit; i < len(boardFiles); i++ {
		filePath := filepath.Join(dirPath, boardFiles[i].Name())
		if err := os.Remove(filePath); err != nil {
			fmt.Printf("删除历史文件失败: %v\n", err)
		}
	}
}
