package server

import (
	"log"
	"os"
	"path/filepath"

	"github.com/jun/fun_code/internal/cache"
	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/database"
	"github.com/jun/fun_code/internal/handler"
	"github.com/jun/fun_code/internal/service"

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

func NewServer(cfg *config.Config) (*Server, error) {
	// 初始化数据库
	db, err := gorm.Open(sqlite.Open(cfg.Database.DSN), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// 自动迁移数据库结构
	database.RunMigrations(db)

	// 确保文件存储目录存在
	if err := os.MkdirAll(cfg.Storage.BasePath, 0755); err != nil {
		return nil, err
	}

	// 初始化服务
	// 创建一个新的会话缓存实例
	c := cache.NewGoCache()
	sessionCache := cache.NewUserSessionCache(c)

	// 初始化 I18n 服务
	i18nService, err := service.NewI18nService(cfg.I18n.LocalesPath, cfg.I18n.DefaultLang)
	if err != nil {
		log.Printf("初始化 I18n 服务失败: %v", err)
		// 继续执行，不要因为 i18n 初始化失败而中断服务启动
	}

	services := service.Services{
		AuthService:    service.NewAuthService(db, []byte(cfg.JWT.SecretKey), sessionCache),
		FileService:    service.NewFileService(db, cfg.Storage.BasePath),
		ScratchService: service.NewScratchService(db, filepath.Join(cfg.Storage.BasePath, "scratch")),
		ClassService:   service.NewClassService(db),
		I18nService:    i18nService, // 添加 I18nService
	}
	// 初始化处理器
	h := handler.NewHandler(
		services, cfg)

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
