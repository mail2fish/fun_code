package dao

import (
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
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

	// 相对路径：programs/YYYY/MM/DD/userID
	relativeDir := filepath.Join(year, month, day, fmt.Sprintf("%d", userID))
	dirPath := filepath.Join(d.basePath, relativeDir)
	if err := os.MkdirAll(dirPath, 0755); err != nil {
		return 0, fmt.Errorf("创建目录失败: %w", err)
	}

	sum := md5.Sum(content)
	md5Str := hex.EncodeToString(sum[:])

	var prog model.Program
	if id == 0 {
		// 新建
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

	// 写入历史文件：ID_MD5.json（内容为程序字符串）
	filename := filepath.Join(dirPath, fmt.Sprintf("%d_%s.json", prog.ID, md5Str))
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		if err := os.WriteFile(filename, content, 0644); err != nil {
			return 0, gorails.NewError(500, gorails.ERR_DAO, global.ERR_MODULE_PROGRAM, global.ErrorCodeWriteFileFailed, global.ErrorMsgWriteFileFailed, err)
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
