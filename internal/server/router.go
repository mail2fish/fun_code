package server

import (
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/handler"
)

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
		auth.POST("/scratch/projects/", s.handler.PostCreateScratchProject)
		auth.PUT("/scratch/projects/:id", s.handler.PutSaveScratchProject)
		auth.GET("/scratch/projects", s.handler.ListScratchProjects)
		auth.DELETE("/scratch/projects/:id", s.handler.DeleteScratchProject)

		// 班级相关路由
		auth.POST("/class/create", s.handler.PostCreateClass)
		// 班级列表路由
		auth.GET("/class/list", s.handler.GetListClasses)
		// 获取单个班级的信息路由
		auth.GET("/classes/:class_id", s.handler.GetClass)
		// 修改班级信息路由
		auth.PUT("/classes/:class_id", s.handler.PutUpdateClass)
	}

	projects := s.router.Group("/projects")
	projects.Use(s.handler.AuthMiddleware())
	{
		projects.GET("/scratch/new", s.handler.GetNewScratchProject)
		projects.GET("/scratch/open/:id", s.handler.GetOpenScratchProject)
	}

	assets := s.router.Group("/assets")
	assets.Use(s.handler.AuthMiddleware())
	// 添加新的路由用于获取Scratch资源文件
	{
		assets.GET("/scratch/:filename", s.handler.GetLibraryAsset)
		assets.POST("/scratch/:asset_id", s.handler.UploadScratchAsset)
	}
}
