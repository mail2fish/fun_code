package server

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/jun/fun_code/internal/cache"
	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/dao"
	"github.com/jun/fun_code/internal/database"
	"github.com/jun/fun_code/internal/handler"
	"github.com/jun/fun_code/internal/i18n"
	"github.com/jun/fun_code/internal/model"
	"go.uber.org/zap"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type Server struct {
	config  *config.Config
	db      *gorm.DB
	handler *handler.Handler
	router  *gin.Engine
}

func NewServer(cfg *config.Config, logger *zap.Logger) (*Server, error) {

	// 初始化数据库
	db, err := gorm.Open(sqlite.Open(cfg.Database.DSN), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// 自动迁移数据库结构
	database.RunMigrations(db)

	// 确保文件存储目录存在
	if err = os.MkdirAll(cfg.Storage.BasePath, 0755); err != nil {
		return nil, err
	}

	// 初始化服务
	// 创建一个新的会话缓存实例
	c := cache.NewGoCache()
	sessionCache := cache.NewUserSessionCache(c)

	// 初始化 I18n 服务
	i18nService, err := i18n.NewI18nService(cfg.I18n.DefaultLang)
	if err != nil {
		panic(fmt.Sprintf("failed to initialize i18n service: %s, %s, %v", cfg.I18n.LocalesPath, cfg.I18n.DefaultLang, err))
		// 继续执行，不要因为 i18n 初始化失败而中断服务启动
	}

	dao := &dao.Dao{
		AuthDao:    dao.NewAuthDao(db, []byte(cfg.JWT.SecretKey), sessionCache),
		FileDao:    dao.NewFileDao(db, cfg.Storage.BasePath),
		ScratchDao: dao.NewScratchDao(db, filepath.Join(cfg.Storage.BasePath, "scratch")),
		ClassDao:   dao.NewClassDao(db),
		UserDao:    dao.NewUserDao(db),
	}

	// 如果admin 用户不存在，则创建新用户
	admin, err := dao.UserDao.GetUserByUsername("admin")
	if err != nil {
		logger.Error("failed to get admin user", zap.Error(err))
	}
	if admin == nil {
		admin = &model.User{
			Username: "admin",
			Password: cfg.AdminPassword,
			Role:     model.RoleAdmin,
		}
		if err := dao.UserDao.CreateUser(admin); err != nil {
			logger.Error("failed to create admin user", zap.Error(err))
		}
	}

	// 初始化处理器
	h := handler.NewHandler(
		dao, i18nService, logger, cfg)

	// 初始化路由
	r := gin.Default()

	// 创建服务器实例
	s := &Server{
		config:  cfg,
		db:      db,
		handler: h,
		router:  r,
	}

	// 设置路由
	s.setupRoutes()

	return s, nil
}

func (s *Server) Start() error {
	log.Printf("Server starting on %s", s.config.Server.Port)
	return s.router.Run(s.config.Server.Port)
}
