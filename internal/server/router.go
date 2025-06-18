package server

import (
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/handler"
	"github.com/mail2fish/gorails/gorails"
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

	s.router.GET("/shares/:token", gorails.Wrap(s.handler.GetShareScratchProjectHandler, handler.RenderTemplateResponse))

	// 公开路由 - 已改造为 gorails.Wrap 形式
	s.router.POST("/api/auth/register", gorails.Wrap(s.handler.RegisterHandler, nil))
	s.router.POST("/api/auth/login", gorails.Wrap(s.handler.LoginHandler, nil))
	s.router.POST("/api/auth/logout", gorails.Wrap(s.handler.LogoutHandler, nil))
	s.router.GET("/api/i18n/languages", gorails.Wrap(s.handler.GetSupportedLanguagesHandler, nil)) // 获取支持的语言列表
	s.router.POST("/api/i18n/language", gorails.Wrap(s.handler.SetLanguageHandler, nil))           // 设置语言

	// 需要认证的路由组
	auth := s.router.Group("/api")
	auth.Use(s.handler.AuthMiddleware())
	{

		auth.GET("/menu/list", gorails.Wrap(s.handler.GetMenuListHandler, nil))

		// Scratch 相关路由 - 已改造为 gorails.Wrap 形式
		auth.GET("/scratch/projects/:id", gorails.Wrap(s.handler.GetScratchProjectHandler, handler.RenderScratchProject))
		auth.POST("/scratch/projects/", gorails.Wrap(s.handler.CreateScratchProjectHandler, nil))
		auth.PUT("/scratch/projects/:id", gorails.Wrap(s.handler.SaveScratchProjectHandler, handler.RenderSaveScratchProjectResponse))
		auth.PUT("/scratch/projects/:id/thumbnail", gorails.Wrap(s.handler.UpdateProjectThumbnailHandler, nil))
		auth.GET("/scratch/projects/:id/thumbnail", gorails.Wrap(s.handler.GetProjectThumbnailHandler, handler.RenderProjectThumbnail))
		auth.GET("/scratch/projects/:id/histories", gorails.Wrap(s.handler.GetScratchProjectHistoriesHandler, nil))
		auth.GET("/scratch/projects", gorails.Wrap(s.handler.ListScratchProjectsHandler, nil))
		auth.GET("/scratch/projects/search", gorails.Wrap(s.handler.SearchScratchHandler, nil))

		// ShareRoute 注册分享相关的路由
		auth.POST("/shares", gorails.Wrap(s.handler.CreateShareHandler, nil))
		auth.GET("/shares/check", gorails.Wrap(s.handler.CheckShareHandler, nil))
		auth.GET("/shares/list", gorails.Wrap(s.handler.ListSharesHandler, nil))
		auth.DELETE("/shares/:id", gorails.Wrap(s.handler.DeleteShareHandler, nil))

		auth.DELETE("/scratch/projects/:id", gorails.Wrap(s.handler.DeleteScratchProjectHandler, nil))

		auth.GET("/files/list", gorails.Wrap(s.handler.ListFilesHandler, nil))
		auth.GET("/files/:id/download", gorails.Wrap(s.handler.DownloadFileHandler, handler.RenderDownloadFile))
		auth.GET("/files/:id/preview", gorails.Wrap(s.handler.PreviewFileHandler, handler.RenderDownloadFile))
		auth.DELETE("/files/:id", gorails.Wrap(s.handler.DeleteFileHandler, nil))

		{
			admin := auth.Group("/admin").Use(s.handler.RequirePermission(handler.PermissionManageAll))
			admin.POST("/classes/create", gorails.Wrap(s.handler.CreateClassHandler, nil))
			// 班级列表路由
			admin.GET("/classes/list", gorails.Wrap(s.handler.ListClassesHandler, nil))
			// 获取单个班级的信息路由
			admin.GET("/classes/:class_id", gorails.Wrap(s.handler.GetClassHandler, nil))
			// 修改班级信息路由
			admin.PUT("/classes/:class_id", gorails.Wrap(s.handler.UpdateClassHandler, nil))
			// 删除班级路由
			admin.DELETE("/classes/:class_id", gorails.Wrap(s.handler.DeleteClassHandler, nil))

			// 用户管理路由 - 已改造为 gorails.Wrap 形式
			admin.POST("/users/create", s.handler.RequirePermission("manage_users"), gorails.Wrap(s.handler.CreateUserHandler, nil))
			admin.GET("/users/list", s.handler.RequirePermission("manage_users"), gorails.Wrap(s.handler.ListUsersHandler, nil))
			admin.PUT("/users/:user_id", s.handler.RequirePermission("manage_users"), gorails.Wrap(s.handler.UpdateUserHandler, nil))
			admin.DELETE("/users/:user_id", gorails.Wrap(s.handler.DeleteUserHandler, nil))
			admin.GET("/users/:user_id", s.handler.RequirePermission("manage_users"), gorails.Wrap(s.handler.GetUserHandler, nil))
			admin.GET("/users/search", s.handler.RequirePermission("manage_users"), gorails.Wrap(s.handler.SearchUsersHandler, nil))
			// 获取所有scratch项目
			admin.GET("/scratch/projects", gorails.Wrap(s.handler.GetAllScratchProjectHandler, nil))

			// 文件管理路由
			admin.POST("/files/upload", gorails.Wrap(s.handler.PostMultiFileUploadHandler, nil))
		}
		// 班级相关路由
	}

	projects := s.router.Group("/projects")
	projects.Use(s.handler.AuthMiddleware())
	{
		projects.GET("/scratch/new", gorails.Wrap(s.handler.GetNewScratchProjectHandler, nil))
		projects.GET("/scratch/open/:id", gorails.Wrap(s.handler.GetOpenScratchProjectHandler, handler.RenderTemplateResponse))
	}

	assets := s.router.Group("/assets")
	assets.Use(s.handler.AuthMiddleware())
	// 添加新的路由用于获取Scratch资源文件 - 已改造为 gorails.Wrap 形式
	{
		assets.GET("/scratch/:filename", gorails.Wrap(s.handler.GetLibraryAssetHandler, handler.RenderLibraryAsset))
		assets.POST("/scratch/:asset_id", gorails.Wrap(s.handler.UploadScratchAssetHandler, nil))
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
