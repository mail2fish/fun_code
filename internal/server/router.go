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
			AllowOrigins:     []string{"http://localhost:3000", "http://localhost:5173", "http://localhost:8601", "http://172.30.55.152:5173"},
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
	s.router.NoRoute(s.handler.TryAuthMiddleware(), func(c *gin.Context) {
		staticHandler.ServeStatic(c)
	})

	s.router.GET("/shares/:token", gorails.Wrap(s.handler.GetShareScratchProjectHandler, handler.RenderTemplateResponse))
	s.router.GET("/shares/assets/scratch/:token/:filename", gorails.Wrap(s.handler.GetShareLibraryAssetHandler, handler.RenderLibraryAsset))

	s.router.GET("/api/shares/info/:token", gorails.Wrap(s.handler.GetShareScratchProjectInfoHandler, nil))
	s.router.GET("/api/shares/scratch/:token", gorails.Wrap(s.handler.GetShareScratchDataHandler, handler.RenderScratchProject))

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
		auth.POST("/scratch/projects", gorails.Wrap(s.handler.CreateScratchProjectHandler, handler.RenderCreateScratchProjectResponse))
		auth.PUT("/scratch/projects/:id", gorails.Wrap(s.handler.SaveScratchProjectHandler, handler.RenderSaveScratchProjectResponse))
		auth.PUT("/scratch/projects/:id/thumbnail", gorails.Wrap(s.handler.UpdateProjectThumbnailHandler, nil))
		auth.GET("/scratch/projects/:id/thumbnail", gorails.Wrap(s.handler.GetProjectThumbnailHandler, handler.RenderProjectThumbnail))
		auth.GET("/scratch/projects/:id/histories", gorails.Wrap(s.handler.GetScratchProjectHistoriesHandler, nil))
		auth.GET("/scratch/projects", gorails.Wrap(s.handler.ListScratchProjectsHandler, nil))
		auth.GET("/scratch/projects/search", gorails.Wrap(s.handler.SearchScratchHandler, nil))

		// Excalidraw 画板路由
		auth.POST("/excalidraw/boards", gorails.Wrap(s.handler.CreateExcalidrawBoardHandler, nil))

		// ShareRoute 注册分享相关的路由
		auth.POST("/shares", gorails.Wrap(s.handler.CreateShareHandler, nil))
		auth.GET("/shares/check", gorails.Wrap(s.handler.CheckShareHandler, nil))
		auth.GET("/shares/all", gorails.Wrap(s.handler.ListAllSharesHandler, nil))
		auth.GET("/shares/user", gorails.Wrap(s.handler.ListUserSharesHandler, nil))
		auth.DELETE("/shares/:id", gorails.Wrap(s.handler.DeleteShareHandler, nil))

		auth.DELETE("/scratch/projects/:id", gorails.Wrap(s.handler.DeleteScratchProjectHandler, nil))

		auth.GET("/files/list", gorails.Wrap(s.handler.ListFilesHandler, nil))
		auth.GET("/files/:id/download", gorails.Wrap(s.handler.DownloadFileHandler, handler.RenderDownloadFile))
		auth.GET("/files/:id/preview", gorails.Wrap(s.handler.PreviewFileHandler, handler.RenderDownloadFile))
		auth.DELETE("/files/:id", gorails.Wrap(s.handler.DeleteFileHandler, nil))
		auth.GET("/files/search", gorails.Wrap(s.handler.SearchFilesHandler, nil))

		auth.GET("/user/info", gorails.Wrap(s.handler.GetCurrentUserHandler, nil))

		// 学生端路由 - 查看自己参与的班级和课程
		auth.GET("/student/classes", gorails.Wrap(s.handler.GetMyClassesHandler, nil))                          // 我的班级列表
		auth.GET("/student/classes/:class_id", gorails.Wrap(s.handler.GetMyClassHandler, nil))                  // 我的班级详情
		auth.GET("/student/classes/:class_id/courses", gorails.Wrap(s.handler.GetMyClassCoursesHandler, nil))   // 我的班级课程
		auth.GET("/student/courses/:course_id/lessons", gorails.Wrap(s.handler.GetMyCourseLessonsHandler, nil)) // 我的课程课时
		auth.GET("/student/courses/:course_id", gorails.Wrap(s.handler.GetMyCourseHandler, nil))                // 我的课程详情
		auth.GET("/student/scratch/projects/:id", gorails.Wrap(s.handler.GetStudentScratchProjectHandler, handler.RenderScratchProject))
		auth.POST("/student/scratch/projects", gorails.Wrap(s.handler.CreateScratchProjectHandler, handler.RenderCreateScratchProjectResponse))

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

			// 班级课程管理路由
			admin.POST("/classes/:class_id/courses", gorails.Wrap(s.handler.AddCourseToClassHandler, nil))
			admin.DELETE("/classes/:class_id/courses/:course_id", gorails.Wrap(s.handler.RemoveCourseFromClassHandler, nil))
			admin.GET("/classes/:class_id/courses", gorails.Wrap(s.handler.GetClassCoursesHandler, nil))
			admin.GET("/classes/:class_id/lessons", gorails.Wrap(s.handler.GetClassLessonsHandler, nil))
			admin.GET("/classes/:class_id/students", gorails.Wrap(s.handler.GetClassStudentsHandler, nil))

			// 课程管理路由
			admin.POST("/courses", gorails.Wrap(s.handler.CreateCourseHandler, nil))
			admin.PUT("/courses/:course_id", gorails.Wrap(s.handler.UpdateCourseHandler, nil))
			admin.GET("/courses/:course_id", gorails.Wrap(s.handler.GetCourseHandler, nil))
			admin.GET("/courses", gorails.Wrap(s.handler.ListCoursesHandler, nil))
			admin.DELETE("/courses/:course_id", gorails.Wrap(s.handler.DeleteCourseHandler, nil))
			admin.PUT("/courses/:course_id/publish", gorails.Wrap(s.handler.PublishCourseHandler, nil))
			admin.POST("/courses/:course_id/copy", gorails.Wrap(s.handler.CopyCourseHandler, nil))
			admin.PUT("/courses/reorder", gorails.Wrap(s.handler.ReorderCoursesHandler, nil))
			admin.GET("/courses/:course_id/lessons", gorails.Wrap(s.handler.GetCourseLessonsHandler, nil))
			admin.PUT("/courses/:course_id/lessons/reorder", gorails.Wrap(s.handler.ReorderLessonsHandler, nil))
			admin.POST("/courses/:course_id/lessons", gorails.Wrap(s.handler.AddLessonToCourseHandler, nil))
			admin.DELETE("/courses/:course_id/lessons/:lesson_id", gorails.Wrap(s.handler.RemoveLessonFromCourseHandler, nil))

			// 课时管理路由
			admin.POST("/lessons", gorails.Wrap(s.handler.CreateLessonHandler, nil))
			admin.PUT("/lessons/:lesson_id", gorails.Wrap(s.handler.UpdateLessonHandler, nil))
			admin.GET("/lessons/:lesson_id", gorails.Wrap(s.handler.GetLessonHandler, nil))
			admin.GET("/lessons", gorails.Wrap(s.handler.ListLessonsHandler, nil))
			admin.DELETE("/lessons/:lesson_id", gorails.Wrap(s.handler.DeleteLessonHandler, nil))

			admin.PUT("/lessons/reorder", gorails.Wrap(s.handler.ReorderLessonsHandler, nil))

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
		projects.GET("/scratch/new", gorails.Wrap(s.handler.GetNewScratchProjectHandler, handler.RenderGetNewScratchProjectResponse))
		projects.GET("/scratch/open/:id", gorails.Wrap(s.handler.GetOpenScratchProjectHandler, handler.RenderTemplateResponse))
		projects.GET("/scratch/lesson/:class_id/:course_id/:lesson_id/:project_id", gorails.Wrap(s.handler.GetLessonScratchProjectHandler, handler.RenderTemplateResponse))

	}

	assets := s.router.Group("/assets")
	assets.Use(s.handler.AuthMiddleware())
	// 添加新的路由用于获取Scratch资源文件 - 已改造为 gorails.Wrap 形式
	{
		assets.GET("/scratch/:filename", gorails.Wrap(s.handler.GetLibraryAssetHandler, handler.RenderLibraryAsset))
		assets.POST("/scratch/:asset_id", gorails.Wrap(s.handler.UploadScratchAssetHandler, handler.RenderUploadScratchAssetResponse))
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
