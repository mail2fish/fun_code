package dao

import (
	"net/http"

	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"gorm.io/gorm"
)

type FileDao interface {
	CreateFile(file *model.File) gorails.Error
	GetFile(fileID uint) (*model.File, gorails.Error)
	GetFileBySHA1(sha1 string) (*model.File, gorails.Error)
	ListFilesWithPagination(pageSize uint, beginID uint, forward, asc bool) ([]*model.File, bool, gorails.Error)
	CountFiles() (int64, gorails.Error)
	DeleteFile(fileID uint) gorails.Error
	UpdateFile(fileID uint, updates map[string]interface{}) gorails.Error
	SearchFiles(keyword string) ([]*model.File, gorails.Error)
}

type FileDaoImpl struct {
	db *gorm.DB
}

func NewFileDao(db *gorm.DB) FileDao {
	return &FileDaoImpl{db: db}
}

func (d *FileDaoImpl) GetFileBySHA1(sha1 string) (*model.File, gorails.Error) {
	var file model.File
	err := d.db.Where("sha1 = ?", sha1).First(&file).Error
	if err != nil {
		return nil, gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_FILE, global.ErrorCodeRecordNotFound, global.ErrorMsgRecordNotFound, err)
	}
	return &file, nil
}

func (d *FileDaoImpl) CreateFile(file *model.File) gorails.Error {
	err := d.db.Create(file).Error
	if err != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_FILE, global.ErrorCodeInsertFailed, global.ErrorMsgInsertFailed, err)
	}
	return nil
}

func (d *FileDaoImpl) GetFile(fileID uint) (*model.File, gorails.Error) {
	var file model.File
	err := d.db.First(&file, fileID).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_FILE, global.ErrorCodeRecordNotFound, global.ErrorMsgRecordNotFound, err)
		}
		return nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_FILE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}
	return &file, nil
}

func (d *FileDaoImpl) DeleteFile(fileID uint) gorails.Error {
	err := d.db.Delete(&model.File{}, fileID).Error
	if err != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_FILE, global.ErrorCodeDeleteFailed, global.ErrorMsgDeleteFailed, err)
	}
	return nil
}

func (d *FileDaoImpl) UpdateFile(fileID uint, updates map[string]interface{}) gorails.Error {
	result := d.db.Model(&model.File{}).Where("id = ?", fileID).Updates(updates)
	if result.Error != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_FILE, global.ErrorCodeFileUpdateFailed, global.ErrorMsgFileUpdateFailed, result.Error)
	}
	if result.RowsAffected == 0 {
		return gorails.NewError(http.StatusNotFound, gorails.ERR_DAO, global.ERR_MODULE_FILE, global.ErrorCodeRecordNotFound, global.ErrorMsgRecordNotFound, nil)
	}
	return nil
}

// ListFilesWithPagination 分页列出文件
// 参数：
// pageSize 为 uint 类型，代表每页的文件数量
// beginID 为 uint 类型，代表分页的起始ID
// forward 为 bool 类型，代表是否向前分页
// asc 为 bool 类型，代表返回结果是否按升序排序
// 返回值：
// []*model.File 类型，代表分页后的文件列表
// bool 类型，代表是否还有更多文件
// error 类型，代表错误信息
func (d *FileDaoImpl) ListFilesWithPagination(pageSize uint, beginID uint, forward, asc bool) ([]*model.File, bool, gorails.Error) {
	var files []*model.File

	// 处理 pageSize 为 0 的情况，使用默认值 20
	if pageSize == 0 {
		pageSize = 20
	}

	// 构建基础查询
	query := d.db

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
	if err := query.Limit(int(pageSize + 1)).Find(&files).Error; err != nil {
		return nil, false, gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_FILE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 处理查询结果
	// asc 为 true 时，返回结果数组按 id 升序排序，代表页面按升序显示
	// asc 为 false 时，返回结果数组按 id 降序排序，代表页面按降序显示
	hasMore := len(files) > int(pageSize)
	if hasMore {
		files = files[:pageSize]
	}

	// 检查查询结果的排序是否与 asc 参数一致，如果不一致则需要反转
	if queryAsc != asc {
		for i, j := 0, len(files)-1; i < j; i, j = i+1, j-1 {
			files[i], files[j] = files[j], files[i]
		}
	}

	return files, hasMore, nil
}

// CountFiles 获取文件总数
func (d *FileDaoImpl) CountFiles() (int64, gorails.Error) {
	var total int64
	if err := d.db.Model(&model.File{}).Count(&total).Error; err != nil {
		return 0, gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_FILE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}
	return total, nil
}

// SearchFiles 搜索文件
func (d *FileDaoImpl) SearchFiles(keyword string) ([]*model.File, gorails.Error) {
	var files []*model.File
	if err := d.db.Where("original_name LIKE ? or description LIKE ?", "%"+keyword+"%", "%"+keyword+"%").Find(&files).Error; err != nil {
		return nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_DAO, global.ERR_MODULE_FILE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}
	return files, nil
}
