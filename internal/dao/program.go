package dao

import (
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	programHistoryFileLimit = 20
)

type ProgramDaoImpl struct {
	db       *gorm.DB
	basePath string
	cfg      *config.Config
	logger   *zap.Logger
}

func NewProgramDao(db *gorm.DB, basePath string, cfg *config.Config, logger *zap.Logger) ProgramDao {
	return &ProgramDaoImpl{db: db, basePath: basePath, cfg: cfg, logger: logger}
}

func (d *ProgramDaoImpl) Save(userID uint, id uint, name string, ext int, content []byte) (uint, error) {
	now := time.Now()
	year := now.Format("2006")
	month := now.Format("01")
	day := now.Format("02")

	// 相对路径：YYYY/MM/DD/userID（与 scratch 一致）
	relativeDir := filepath.Join(year, month, day, fmt.Sprintf("%d", userID))

	sum := md5.Sum(content)
	md5Str := hex.EncodeToString(sum[:])

	var prog model.Program
	if id == 0 {
		// 新建
		// 仅新建时创建目录
		dirPath := filepath.Join(d.basePath, relativeDir)
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			return 0, fmt.Errorf("创建目录失败: %w", err)
		}
		prog = model.Program{
			UserID:    userID,
			Name:      name,
			Ext:       ext,
			MD5:       md5Str,
			FilePath:  relativeDir,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := d.db.Create(&prog).Error; err != nil {
			return 0, gorails.NewError(500, gorails.ERR_DAO, global.ERR_MODULE_PROGRAM, global.ErrorCodeInsertFailed, global.ErrorMsgInsertFailed, err)
		}
	} else {
		// 更新
		if err := d.db.Where("id = ? AND user_id = ?", id, userID).First(&prog).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return 0, errors.New("程序不存在或无权访问")
			}
			return 0, err
		}
		prog.Name = name
		prog.Ext = ext
		prog.MD5 = md5Str
		prog.UpdatedAt = now
		if err := d.db.Save(&prog).Error; err != nil {
			return 0, gorails.NewError(500, gorails.ERR_DAO, global.ERR_MODULE_PROGRAM, global.ErrorCodeUpdateFailed, global.ErrorMsgUpdateFailed, err)
		}
	}

	// 历史文件目录基于程序自身 FilePath（仅新建时确保存在）
	dirPath := filepath.Join(d.basePath, prog.FilePath)
	if id == 0 {
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			return 0, fmt.Errorf("创建目录失败: %w", err)
		}
	}

	// 写入历史文件：ID_MD5.json（内容为程序字符串）
	filename := filepath.Join(dirPath, fmt.Sprintf("%d_%s.json", prog.ID, md5Str))
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		if err := os.WriteFile(filename, content, 0644); err != nil {
			return 0, gorails.NewError(500, gorails.ERR_DAO, global.ERR_MODULE_PROGRAM, global.ErrorCodeWriteFileFailed, global.ErrorMsgWriteFileFailed, err)
		}
	}

	// 历史清理：只保留最近 programHistoryFileLimit 个
	pattern := filepath.Join(dirPath, fmt.Sprintf("%d_*.json", prog.ID))
	files, err := filepath.Glob(pattern)
	if err == nil && len(files) > programHistoryFileLimit {
		type hist struct {
			path string
			mod  time.Time
		}
		histories := make([]hist, 0, len(files))
		for _, f := range files {
			if info, e := os.Stat(f); e == nil {
				histories = append(histories, hist{path: f, mod: info.ModTime()})
			}
		}
		sort.Slice(histories, func(i, j int) bool { return histories[i].mod.After(histories[j].mod) })
		for i := programHistoryFileLimit; i < len(histories); i++ {
			_ = os.Remove(histories[i].path)
		}
	}

	return prog.ID, nil
}

func (d *ProgramDaoImpl) Get(id uint) (*model.Program, error) {
	var prog model.Program
	if err := d.db.Where("id = ?", id).First(&prog).Error; err != nil {
		return nil, err
	}
	return &prog, nil
}

func (d *ProgramDaoImpl) GetContent(id uint, md5Str string) ([]byte, error) {
	var prog model.Program
	if err := d.db.Where("id = ?", id).First(&prog).Error; err != nil {
		return nil, err
	}
	if md5Str == "" {
		md5Str = prog.MD5
	}
	filename := filepath.Join(d.basePath, prog.FilePath, fmt.Sprintf("%d_%s.json", prog.ID, md5Str))
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (d *ProgramDaoImpl) ListProgramsWithPagination(userID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Program, bool, error) {
	var programs []model.Program

	// 处理 pageSize 为 0 的情况，使用默认值 20
	if pageSize == 0 {
		pageSize = 20
	}

	// 构建基础查询
	query := d.db.Where("user_id = ?", userID)

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
	if err := query.Limit(int(pageSize + 1)).Find(&programs).Error; err != nil {
		return nil, false, err
	}

	// 处理查询结果
	// asc 为 true 时，返回结果数组按 id 升序排序，代表页面按升序显示
	// asc 为 false 时，返回结果数组按 id 降序排序，代表页面按降序显示
	// 检查查询结果的排序是否与 asc 参数一致，如果不一致则需要反转
	if queryAsc != asc {
		// 反转结果数组
		for i, j := 0, len(programs)-1; i < j; i, j = i+1, j-1 {
			programs[i], programs[j] = programs[j], programs[i]
		}
	}

	// 判断是否有更多数据
	hasMore := false
	if len(programs) > int(pageSize) {
		hasMore = true
		if queryAsc != asc {
			programs = programs[1:]
		} else {
			programs = programs[:int(pageSize)]
		}
	}

	return programs, hasMore, nil
}

func (d *ProgramDaoImpl) CountPrograms(userID uint) (int64, error) {
	var count int64
	err := d.db.Model(&model.Program{}).Where("user_id = ?", userID).Count(&count).Error
	return count, err
}

// ListAllProgramsWithPagination 分页获取所有程序列表（管理员用）
func (d *ProgramDaoImpl) ListAllProgramsWithPagination(pageSize uint, beginID uint, forward, asc bool, userID *uint) ([]model.Program, bool, error) {
	var programs []model.Program

	// 处理 pageSize 为 0 的情况，使用默认值 20
	if pageSize == 0 {
		pageSize = 20
	}

	// 构建基础查询
	query := d.db.Model(&model.Program{})

	// 如果指定了用户ID，则添加用户筛选
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
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

	// 执行查询，获取比 pageSize 多一条记录，用于判断是否还有更多数据
	err := query.Limit(int(pageSize) + 1).Find(&programs).Error
	if err != nil {
		return nil, false, err
	}

	// 处理查询结果
	// asc 为 true 时，返回结果数组按 id 升序排序，代表页面按升序显示
	// asc 为 false 时，返回结果数组按 id 降序排序，代表页面按降序显示
	// 检查查询结果的排序是否与 asc 参数一致，如果不一致则需要反转
	if queryAsc != asc {
		// 反转结果数组
		for i, j := 0, len(programs)-1; i < j; i, j = i+1, j-1 {
			programs[i], programs[j] = programs[j], programs[i]
		}
	}

	// 判断是否有更多数据
	hasMore := false
	if len(programs) > int(pageSize) {
		hasMore = true
		if queryAsc != asc {
			programs = programs[1:]
		} else {
			programs = programs[:int(pageSize)]
		}
	}

	return programs, hasMore, nil
}

// CountAllPrograms 获取所有程序总数（管理员用）
func (d *ProgramDaoImpl) CountAllPrograms(userID *uint) (int64, error) {
	var count int64
	query := d.db.Model(&model.Program{})

	// 如果指定了用户ID，则添加用户筛选
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}

	err := query.Count(&count).Error
	return count, err
}

// SearchPrograms 搜索程序（管理员用）
func (d *ProgramDaoImpl) SearchPrograms(keyword string, userID *uint) ([]model.Program, error) {
	var programs []model.Program

	query := d.db.Model(&model.Program{}).Where("name LIKE ?", "%"+keyword+"%")

	// 如果指定了用户ID，则添加用户筛选
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}

	err := query.Order("id DESC").Find(&programs).Error
	return programs, err
}

// Delete 删除程序
func (d *ProgramDaoImpl) Delete(id uint) error {
	// 先获取程序信息，确定文件路径
	program, err := d.Get(id)
	if err != nil {
		return err
	}
	if program == nil {
		return fmt.Errorf("程序不存在")
	}

	// 删除数据库记录
	err = d.db.Delete(&model.Program{}, id).Error
	if err != nil {
		return err
	}

	// 删除程序文件目录
	programDir := filepath.Join(d.basePath, program.FilePath)
	if _, err := os.Stat(programDir); err == nil {
		err = os.RemoveAll(programDir)
		if err != nil {
			// 记录错误但不返回，因为数据库记录已经删除
			fmt.Printf("警告：删除程序文件目录失败: %v\n", err)
		}
	}

	return nil
}
