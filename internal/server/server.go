package server

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	ginzap "github.com/gin-contrib/zap"
	"github.com/jun/fun_code/internal/cache"
	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/custom_error"
	"github.com/jun/fun_code/internal/dao"
	"github.com/jun/fun_code/internal/database"
	"github.com/jun/fun_code/internal/handler"
	"github.com/jun/fun_code/internal/i18n"
	"github.com/jun/fun_code/internal/model"
	"go.uber.org/zap"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
	"moul.io/zapgorm2"
)

type Server struct {
	config    *config.Config
	db        *gorm.DB
	handler   *handler.Handler
	router    *gin.Engine
	etagCache cache.ETagCache
	logger    *zap.Logger
}

func NewServer(cfg *config.Config, logger *zap.Logger) (*Server, error) {

	gormConfig := &gorm.Config{}

	if cfg.Env == "production" {
		cloger := zapgorm2.New(logger)
		cloger.SetAsDefault()
		cloger.LogLevel = gormlogger.Silent
		gormConfig.Logger = cloger
	}

	// 初始化数据库
	db, err := gorm.Open(sqlite.Open(cfg.Database.DSN), gormConfig)
	if err != nil {
		return nil, err
	}
	if cfg.Env != "production" {
		db = db.Debug()
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
	etagCache := cache.NewETagCache(c)

	// 初始化 I18n 服务
	i18nService, err := i18n.NewI18nService(cfg.I18n.DefaultLang)
	if err != nil {
		panic(fmt.Sprintf("failed to initialize i18n service: %s, %s, %v", cfg.I18n.LocalesPath, cfg.I18n.DefaultLang, err))
		// 继续执行，不要因为 i18n 初始化失败而中断服务启动
	}

	isDemo := cfg.Env == "demo"

	fDao := &dao.Dao{
		AuthDao:      dao.NewAuthDao(db, []byte(cfg.JWT.SecretKey), sessionCache, isDemo),
		FileDao:      dao.NewFileDao(db, cfg.Storage.BasePath),
		ScratchDao:   dao.NewScratchDao(db, filepath.Join(cfg.Storage.BasePath, "scratch")),
		ClassDao:     dao.NewClassDao(db),
		UserDao:      dao.NewUserDao(db),
		UserAssetDao: dao.NewUserAssetDao(db),
	}

	// 如果admin 用户不存在，则创建新用户
	admin, err := fDao.UserDao.GetUserByUsername("admin")

	if err != nil && !custom_error.IsCustomError(err, custom_error.DAO, custom_error.USER, dao.ErrorCodeQueryNotFound) {
		logger.Error("failed to get admin user", zap.Error(err))
	}
	if admin == nil {
		admin = &model.User{
			Username: "admin",
			Password: cfg.AdminPassword,
			Role:     model.RoleAdmin,
		}
		if err := fDao.UserDao.CreateUser(admin); err != nil {
			logger.Error("failed to create admin user", zap.Error(err))
		}
	}

	// 初始化处理器
	h := handler.NewHandler(
		fDao, i18nService, logger, cfg)

	// 初始化路由，开发环境使用默认路由，生产环境使用自定义路由
	// 路由使用 zap logger 记录日志
	var r *gin.Engine
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
		r = gin.New()
		// Add Zap logger middleware
		r.Use(ginzap.Ginzap(logger, time.RFC3339, true))
		r.Use(ginzap.RecoveryWithZap(logger, true))
	} else {
		r = gin.Default()
		gin.SetMode(gin.DebugMode)

	}

	// 创建服务器实例
	s := &Server{
		config:    cfg,
		db:        db,
		handler:   h,
		router:    r,
		etagCache: etagCache,
		logger:    logger,
	}

	// 设置路由
	s.setupRoutes()

	return s, nil
}

func (s *Server) Start() error {
	fmt.Printf("Server starting on %s\n", s.config.Server.Port)
	return s.router.Run(s.config.Server.Port)
}
