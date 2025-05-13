package server

import (
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/handler"
)

//	@title			FuncCode API
//	@version		0.0.1
//	@description	This is a sample server celler server.
//	@termsOfService	hhttps://github.com/mail2fish/fun_code

//	@contact.name	Jack Yu
//	@contact.url
//	@contact.email	mail2fish@gmail.com

//	@license.name	Apache 2.0
//	@license.url	http://www.apache.org/licenses/LICENSE-2.0.html

// @host		localhost:8080
// @BasePath	/api/

func (s *Server) setupRoutes() {

	// 添加新的CORS中间件
	if s.config.Env != "production" {
		s.router.Use(cors.New(cors.Config{
			AllowOrigins:     []string{"http://localhost:3000", "http://localhost:5173", "http://localhost:8601"},
			AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Content-Length"},
			AllowCredentials: true,
			MaxAge:           12 * time.Hour,
		}))
	}

	// 添加静态文件服务
	staticHandler, err := handler.NewStaticHandler(s.etagCache)
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
	s.router.POST("/api/auth/logout", s.handler.Logout)
	s.router.GET("/api/i18n/languages", s.handler.GetSupportedLanguages) // 获取支持的语言列表
	s.router.POST("/api/i18n/language", s.handler.SetLanguage)           // 设置语言

	// 需要认证的路由组
	auth := s.router.Group("/api")
	auth.Use(s.handler.AuthMiddleware())
	{

		auth.GET("/menu/list", s.handler.GetMenuList)

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
		auth.PUT("/scratch/projects/:id/thumbnail", s.handler.PutUpdateProjectThumbnail)
		auth.GET("/scratch/projects/:id/thumbnail", s.handler.GetProjectThumbnail)
		auth.GET("/scratch/projects", s.handler.ListScratchProjects)
		auth.DELETE("/scratch/projects/:id", s.handler.DeleteScratchProject)

		{
			admin := auth.Group("/admin").Use(s.handler.RequirePermission(handler.PermissionManageAll))
			admin.POST("/classes/create", s.handler.PostCreateClass)
			// 班级列表路由
			admin.GET("/classes/list", s.handler.GetListClasses)
			// 获取单个班级的信息路由
			admin.GET("/classes/:class_id", s.handler.GetClass)
			// 修改班级信息路由
			admin.PUT("/classes/:class_id", s.handler.PutUpdateClass)
			// 删除班级路由
			admin.DELETE("/classes/:class_id", s.handler.DeleteClass)

			// 用户管理路由
			admin.POST("/users/create", s.handler.RequirePermission("manage_users"), s.handler.PostCreateUser)
			admin.GET("/users/list", s.handler.RequirePermission("manage_users"), s.handler.GetListUsers)
			admin.PUT("/users/:user_id", s.handler.RequirePermission("manage_users"), s.handler.PutUpdateUser)
			admin.DELETE("/users/:user_id", s.handler.RequirePermission("manage_users"), s.handler.DeleteUser)
			admin.GET("/users/:user_id", s.handler.RequirePermission("manage_users"), s.handler.GetUser)
			// 获取所有scratch项目
			admin.GET("/scratch/projects", s.handler.GetAllScratchProject)
		}
		// 班级相关路由
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

// // 在 setupRoutes 函数中添加权限中间件

// // Scratch 相关路由
// auth.GET("/scratch/projects/:id", s.handler.RequireOwnership("scratch_project", "id"), s.handler.GetScratchProject)
// auth.POST("/scratch/projects/", s.handler.RequirePermission("create_scratch"), s.handler.PostCreateScratchProject)
// auth.PUT("/scratch/projects/:id", s.handler.RequireOwnership("scratch_project", "id"), s.handler.PutSaveScratchProject)
// auth.GET("/scratch/projects", s.handler.RequirePermission("view_own_scratch"), s.handler.ListScratchProjects)
// auth.DELETE("/scratch/projects/:id", s.handler.RequireOwnership("scratch_project", "id"), s.handler.DeleteScratchProject)

// // 班级相关路由
// auth.POST("/class/create", s.handler.RequirePermission("manage_own_class"), s.handler.PostCreateClass)
// auth.GET("/class/list", s.handler.GetListClasses)
// auth.GET("/classes/:class_id", s.handler.GetClass)
// auth.PUT("/classes/:class_id", s.handler.RequireOwnership("class", "class_id"), s.handler.PutUpdateClass)

// // 用户角色管理
// auth.POST("/users/role", s.handler.SetUserRole)
// auth.GET("/users/permissions", s.handler.GetCurrentUserPermissions)
