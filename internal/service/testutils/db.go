package testutils

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/jun/fun_code/internal/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func SetupTestDB() *gorm.DB {
	// 使用随机数生成唯一的数据库名称，确保每个测试使用独立的数据库实例
	// 使用新的随机数生成方式
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	dbName := fmt.Sprintf("file:memdb%d?mode=memory&cache=shared", r.Int())

	db, err := gorm.Open(sqlite.Open(dbName), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	// 自动迁移数据库结构，创建必要的表
	err = db.AutoMigrate(&model.User{}, &model.File{}, &model.ScratchProject{})
	if err != nil {
		panic("failed to migrate database: " + err.Error())
	}

	// 迁移会话模型
	if err := db.AutoMigrate(&model.UserSession{}); err != nil {
		panic("failed to migrate database: " + err.Error())
	}

	return db
}
