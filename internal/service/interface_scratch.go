package service

import "github.com/jun/fun_code/internal/model"

// ScratchService 定义了Scratch项目服务的接口
type ScratchService interface {
	// GetProjectBinary 获取指定ID的Scratch项目的二进制内容
	GetProjectBinary(projectID uint) ([]byte, error)

	// GetProject 获取指定ID的Scratch项目
	GetProject(projectID uint) (*model.ScratchProject, error)

	// SaveProject 保存Scratch项目
	SaveProject(userID uint, projectID uint, name string, content []byte) (uint, error)

	// ListProjectsWithPagination 分页列出用户的所有项目
	ListProjectsWithPagination(userID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.ScratchProject, bool, error)

	// DeleteProject 删除项目
	DeleteProject(userID uint, projectID uint) error

	// ProjectExist 检查project 是否存在
	ProjectExist(projectID uint) bool

	GetScratchBasePath() string

	CountProjects(userID uint) (int64, error)
}
