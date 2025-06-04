package dao

import (
	"gorm.io/gorm"
)

type FileDaoImpl struct {
	db       *gorm.DB
	basePath string
}

// func NewFileDao(db *gorm.DB, basePath string) FileDao {
// 	return &FileDaoImpl{db: db, basePath: basePath}
// }
