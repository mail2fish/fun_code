package dao

import (
	"net/http"

	"github.com/jun/fun_code/internal/model"
)

type Dao struct {
	AuthDao       AuthDao
	UserDao       UserDao
	FileDao       FileDao
	ClassDao      ClassDao
	CourseDao     CourseDao
	LessonDao     LessonDao
	ScratchDao    ScratchDao
	UserAssetDao  UserAssetDao
	ShareDao      ShareDao
	ExcalidrawDao ExcalidrawDAO
	ProgramDao    ProgramDao
}

type AuthDao interface {
	Register(username, password, email string) error
	Login(username, password string) (*LoginResponse, error)
	Logout(token string) (*http.Cookie, error)
	ValidateToken(tokenString string) (*Claims, error)
	GenerateCookie(token string) *http.Cookie
}

// ProgramDao 定义通用程序的数据访问接口
type ProgramDao interface {
	// Save 通过 id 判断新建或更新（id==0 新建），写入历史文件，返回程序ID
	Save(userID uint, id uint, name string, ext int, content []byte) (uint, error)
	// Get 读取程序元信息
	Get(id uint) (*model.Program, error)
	// GetContent 读取当前版本内容（若 md5 为空则读取最新 md5）
	GetContent(id uint, md5 string) ([]byte, error)
	// ListProgramsWithPagination 分页获取用户程序列表
	ListProgramsWithPagination(userID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Program, bool, error)
	// CountPrograms 获取用户程序总数
	CountPrograms(userID uint) (int64, error)
}
