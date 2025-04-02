package service

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/jun/fun_code/internal/model"

	"gorm.io/gorm"
)

// ScratchService 定义了Scratch项目服务的接口
type ScratchService interface {
	// GetProject 获取指定ID的Scratch项目
	GetProject(projectID uint) ([]byte, error)

	// SaveProject 保存Scratch项目
	SaveProject(userID uint, projectID uint, name string, content []byte) (uint, error)

	// ListProjects 列出用户的所有项目
	ListProjects(userID uint) ([]model.ScratchProject, error)

	// DeleteProject 删除项目
	DeleteProject(userID uint, projectID uint) error
}

// ScratchServiceImpl 实现了ScratchService接口
type ScratchServiceImpl struct {
	db       *gorm.DB
	basePath string // 文件存储的基础路径
}

// NewScratchService 创建一个新的ScratchService实例
func NewScratchService(db *gorm.DB, basePath string) ScratchService {
	return &ScratchServiceImpl{
		db:       db,
		basePath: basePath,
	}
}

// GetProject 获取指定ID的Scratch项目
func (s *ScratchServiceImpl) GetProject(projectID uint) ([]byte, error) {
	// 如果projectID为0，返回示例项目
	if projectID == 0 || projectID == 1233 {
		return s.getExampleProject(), nil
	}

	// 从数据库查询项目
	var project model.ScratchProject
	if err := s.db.Where("id = ?", projectID).First(&project).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("项目不存在")
		}
		return nil, err
	}

	// 从文件系统读取项目内容
	content, err := os.ReadFile(project.FilePath)
	if err != nil {
		return nil, fmt.Errorf("读取项目文件失败: %w", err)
	}

	return content, nil
}

// SaveProject 保存Scratch项目
func (s *ScratchServiceImpl) SaveProject(userID uint, projectID uint, name string, content []byte) (uint, error) {
	// 检查项目是否已存在
	var project model.ScratchProject
	result := s.db.Where("id = ?", projectID).First(&project)

	now := time.Now()
	year := now.Format("2006")
	month := now.Format("01")

	// 构建文件路径
	dirPath := filepath.Join(s.basePath, fmt.Sprintf("%d", userID), year, month)

	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			// 创建目录
			if err := os.MkdirAll(dirPath, 0755); err != nil {
				return 0, fmt.Errorf("创建目录失败: %w", err)
			}

			// 创建新项目记录
			project = model.ScratchProject{
				UserID:    userID,
				Name:      name,
				CreatedAt: now,
				UpdatedAt: now,
			}

			// 先创建数据库记录以获取ID
			if err := s.db.Create(&project).Error; err != nil {
				return 0, err
			}

			// 使用生成的ID构建文件名
			filePath := filepath.Join(dirPath, strconv.FormatUint(uint64(project.ID), 10)+".json")
			project.FilePath = filePath

			// 更新文件路径
			if err := s.db.Save(&project).Error; err != nil {
				return 0, err
			}

			// 写入文件
			if err := ioutil.WriteFile(filePath, content, 0644); err != nil {
				// 如果写入文件失败，删除数据库记录
				s.db.Delete(&project)
				return 0, fmt.Errorf("写入文件失败: %w", err)
			}
		} else {
			return 0, result.Error
		}
	} else {
		// 检查用户是否有权限修改
		if project.UserID != userID {
			return 0, errors.New("无权修改此项目")
		}

		// 构建新的文件路径
		filePath := filepath.Join(dirPath, strconv.FormatUint(uint64(project.ID), 10)+".json")

		// 如果文件路径变更，需要创建新目录
		if project.FilePath != filePath {
			if err := os.MkdirAll(dirPath, 0755); err != nil {
				return 0, fmt.Errorf("创建目录失败: %w", err)
			}
		}

		// 写入文件
		if err := ioutil.WriteFile(filePath, content, 0644); err != nil {
			return 0, fmt.Errorf("写入文件失败: %w", err)
		}

		// 如果文件路径变更，删除旧文件
		if project.FilePath != filePath {
			os.Remove(project.FilePath)
		}

		// 更新项目记录
		project.Name = name
		project.FilePath = filePath
		project.UpdatedAt = now
		if err := s.db.Save(&project).Error; err != nil {
			return 0, err
		}
	}

	return project.ID, nil
}

// ListProjects 列出用户的所有项目
func (s *ScratchServiceImpl) ListProjects(userID uint) ([]model.ScratchProject, error) {
	var projects []model.ScratchProject
	if err := s.db.Where("user_id = ?", userID).Find(&projects).Error; err != nil {
		return nil, err
	}
	return projects, nil
}

// DeleteProject 删除项目
func (s *ScratchServiceImpl) DeleteProject(userID uint, projectID uint) error {
	// 检查项目是否存在
	var project model.ScratchProject
	if err := s.db.Where("id = ?", projectID).First(&project).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("项目不存在")
		}
		return err
	}

	// 检查用户是否有权限删除
	if project.UserID != userID {
		return errors.New("无权删除此项目")
	}

	// 删除文件
	if err := os.Remove(project.FilePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("删除项目文件失败: %w", err)
	}

	// 删除数据库记录
	if err := s.db.Delete(&project).Error; err != nil {
		return err
	}

	return nil
}

// getExampleProject 返回示例项目
func (s *ScratchServiceImpl) getExampleProject() []byte {
	result := `{"targets":[{"isStage":true,"name":"Stage","variables":{"` + "`" + `jEk@4|i[#Fk?(8x)AV.-my variable":["my variable",0]},"lists":{},"broadcasts":{},"blocks":{},"comments":{},"currentCostume":0,"costumes":[{"name":"backdrop1","dataFormat":"svg","assetId":"cd21514d0531fdffb22204e0ec5ed84a","md5ext":"cd21514d0531fdffb22204e0ec5ed84a.svg","rotationCenterX":240,"rotationCenterY":180}],"sounds":[{"name":"pop","assetId":"83a9787d4cb6f3b7632b4ddfebf74367","dataFormat":"wav","format":"","rate":48000,"sampleCount":1123,"md5ext":"83a9787d4cb6f3b7632b4ddfebf74367.wav"}],"volume":100,"layerOrder":0,"tempo":60,"videoTransparency":50,"videoState":"on","textToSpeechLanguage":null},{"isStage":false,"name":"Sprite1","variables":{},"lists":{},"broadcasts":{},"blocks":{"MvnU:C*rPc=Q7{LV-*F9":{"opcode":"motion_movesteps","next":";YZXVOf%nL3([N],fGSi","parent":null,"inputs":{"STEPS":[1,[4,"10"]]},"fields":{},"shadow":false,"topLevel":true,"x":156,"y":283},";YZXVOf%nL3([N],fGSi":{"opcode":"motion_movesteps","next":null,"parent":"MvnU:C*rPc=Q7{LV-*F9","inputs":{"STEPS":[1,[4,"10"]]},"fields":{},"shadow":false,"topLevel":false}},"comments":{},"currentCostume":0,"costumes":[{"name":"costume1","bitmapResolution":1,"dataFormat":"svg","assetId":"bcf454acf82e4504149f7ffe07081dbc","md5ext":"bcf454acf82e4504149f7ffe07081dbc.svg","rotationCenterX":48,"rotationCenterY":50},{"name":"costume2","bitmapResolution":1,"dataFormat":"svg","assetId":"0fb9be3e8397c983338cb71dc84d0b25","md5ext":"0fb9be3e8397c983338cb71dc84d0b25.svg","rotationCenterX":46,"rotationCenterY":53}],"sounds":[{"name":"Meow","assetId":"83c36d806dc92327b9e7049a565c6bff","dataFormat":"wav","format":"","rate":48000,"sampleCount":40681,"md5ext":"83c36d806dc92327b9e7049a565c6bff.wav"}],"volume":100,"layerOrder":1,"visible":true,"x":0,"y":0,"size":100,"direction":90,"draggable":false,"rotationStyle":"all around"}],"monitors":[],"extensions":[],"meta":{"semver":"3.0.0","vm":"11.0.0-beta.2","agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"}}`
	return []byte(result)
}
