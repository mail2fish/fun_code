package server

import (
	"log"
	"os"
	"path/filepath"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/handler"
	"github.com/jun/fun_code/internal/model"
	"github.com/jun/fun_code/internal/service"

	"time"

	"github.com/gin-contrib/cors"
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
	if err := db.AutoMigrate(&model.User{}, &model.File{}, &model.ScratchProject{}); err != nil {
		return nil, err
	}

	// 确保文件存储目录存在
	if err := os.MkdirAll(cfg.Storage.BasePath, 0755); err != nil {
		return nil, err
	}

	// 初始化服务
	authService := service.NewAuthService(db, []byte(cfg.JWT.SecretKey))
	fileService := service.NewFileService(db, cfg.Storage.BasePath)
	scratchService := service.NewScratchService(db, filepath.Join(cfg.Storage.BasePath, "scratch"))

	// 初始化处理器
	h := handler.NewHandler(authService, fileService, scratchService)

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

func (s *Server) setupRoutes() {

	// 添加新的CORS中间件
	s.router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost:5173", "http://localhost:8601"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 添加静态文件服务
	staticHandler, err := handler.NewStaticHandler()
	if err != nil {
		log.Printf("无法初始化静态文件处理器: %v", err)
		return
	}

	// 处理 /public 路径下的所有请求
	s.router.NoRoute(func(c *gin.Context) {
		staticHandler.ServeStatic(c)
	})

	// 公开路由
	s.router.POST("/api/auth/register", s.handler.Register)
	s.router.POST("/api/auth/login", s.handler.Login)

	// 需要认证的路由组
	auth := s.router.Group("/api")
	auth.Use(s.handler.AuthMiddleware())
	{
		// 目录操作
		auth.POST("/directories", s.handler.CreateDirectory)

		// 文件操作
		auth.POST("/files", s.handler.UploadFile)
		auth.GET("/files", s.handler.ListFiles)
		auth.GET("/files/:id", s.handler.DownloadFile)
		auth.DELETE("/files/:id", s.handler.DeleteFile)

		// Scratch 相关路由
		auth.GET("/scratch/projects/:id", s.handler.GetScratchProject)
		auth.POST("/scratch/projects/", s.handler.CreateScratchProject)
		auth.PUT("/scratch/projects/:id", s.handler.SaveScratchProject)
		auth.GET("/scratch/projects", s.handler.ListScratchProjects)
		auth.DELETE("/scratch/projects/:id", s.handler.DeleteScratchProject)
	}

	projects := s.router.Group("/projects")
	projects.Use(s.handler.AuthMiddleware())
	{
		projects.GET("/scratch/:id", s.handler.OpenScratchProject)
	}
}

func (s *Server) Start() error {
	log.Printf("Server starting on %s", s.config.Server.Port)
	return s.router.Run(s.config.Server.Port)
}
