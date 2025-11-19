package database

import (
	"github.com/jun/fun_code/internal/model"
	"gorm.io/gorm"
)

// RunMigrations 运行所有数据库迁移
func RunMigrations(db *gorm.DB) error {
	// 迁移现有模型
	if err := db.AutoMigrate(&model.User{}); err != nil {
		return err
	}

	// 迁移会话模型
	if err := db.AutoMigrate(&model.UserSession{}); err != nil {
		return err
	}

	// 迁移班级模型
	if err := db.AutoMigrate(&model.Class{}); err != nil {
		return err
	}
	// 迁移班级成员模型
	if err := db.AutoMigrate(&model.ClassUser{}); err != nil {
		return err
	}
	// 迁移班级课程模型
	if err := db.AutoMigrate(&model.ClassCourse{}); err != nil {
		return err
	}

	// 迁移课程模型
	if err := db.AutoMigrate(&model.Course{}); err != nil {
		return err
	}

	// 迁移课时资源文件关联模型
	if err := db.AutoMigrate(&model.LessonFile{}); err != nil {
		return err
	}

	// 迁移课时模型
	if err := db.AutoMigrate(&model.Lesson{}); err != nil {
		return err
	}

	// 迁移课时课程关联模型
	if err := db.AutoMigrate(&model.LessonCourse{}); err != nil {
		return err
	}



	// 迁移文件模型 ScratchProject
	if err := db.AutoMigrate(&model.File{}, &model.ScratchProject{}, &model.Program{}); err != nil {
		return err
	}

	// 迁移用户资源模型
	if err := db.AutoMigrate(&model.UserAsset{}); err != nil {
		return err
	}

	// 迁移分享模型
	if err := db.AutoMigrate(&model.Share{}); err != nil {
		return err
	}

	// 迁移Excalidraw画板模型
	if err := db.AutoMigrate(&model.ExcalidrawBoard{}); err != nil {
		return err
	}

	return nil
}
