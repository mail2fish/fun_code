package server

import (
	"fun_code/internal/config"
	"fun_code/internal/handler"
	"fun_code/internal/model"
	"fun_code/internal/service"
	"log"
	"os"
	"path/filepath"

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
	// 设置CORS中间件
	s.router.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowedOrigins := []string{"http://localhost:5173", "http://localhost:8601", "http://localhost:3000"}

		for _, allowed := range allowedOrigins {
			if origin == allowed {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// 公开路由
	s.router.POST("/api/auth/register", s.handler.Register)
	s.router.POST("/api/auth/login", s.handler.Login)
	s.router.GET("/api/scratch/projects/:id", s.handler.GetScratchProject)

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
		// auth.GET("/scratch/projects/:id", s.handler.GetScratchProject)
		auth.PUT("/scratch/projects/:id", s.handler.SaveScratchProject)
		auth.GET("/scratch/projects", s.handler.ListScratchProjects)
		auth.DELETE("/scratch/projects/:id", s.handler.DeleteScratchProject)
	}
}

func (s *Server) Start() error {
	log.Printf("Server starting on %s", s.config.Server.Port)
	return s.router.Run(s.config.Server.Port)
}
