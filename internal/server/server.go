package server

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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
		FileDao:      dao.NewFileDao(db),
		ScratchDao:   dao.NewScratchDao(db, filepath.Join(cfg.Storage.BasePath, "scratch"), cfg, logger),
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
	// 获取本地IP用于显示
	host, err := getLocalIP()
	if err != nil {
		host = "localhost"
	}

	// 兼容旧配置：如果使用了旧的Port配置，则设置为默认模式
	if s.config.Server.Port != "" && s.config.Server.HTTPPort == "" {
		s.config.Server.HTTPPort = s.config.Server.Port
		s.config.Server.Mode = config.ModeDefault
	}

	switch s.config.Server.Mode {
	case config.ModeHTTPOnly:
		return s.startHTTPOnly(host)
	case config.ModeHTTPSOnly:
		return s.startHTTPSOnly(host)
	case config.ModeBoth:
		return s.startBoth(host)
	case config.ModeHTTPSRedirect:
		return s.startHTTPSRedirect(host)
	case config.ModeDefault:
		fallthrough
	default:
		return s.startDefault(host)
	}
}

// startHTTPOnly 启动模式1：只有HTTP
func (s *Server) startHTTPOnly(host string) error {
	fmt.Printf("Startup Mode: HTTP Only\n")
	fmt.Printf("Service accessible at:\n- Local access: http://localhost%s\n- Network access: http://%s%s\n",
		s.config.Server.HTTPPort, host, s.config.Server.HTTPPort)

	return s.router.Run(s.config.Server.HTTPPort)
}

// startHTTPSOnly 启动模式2：只有HTTPS
func (s *Server) startHTTPSOnly(host string) error {
	if err := s.validateTLSConfig(); err != nil {
		return fmt.Errorf("HTTPS configuration error: %v", err)
	}

	fmt.Printf("Startup Mode: HTTPS Only\n")
	fmt.Printf("Service accessible at:\n- Local access: https://localhost%s\n- Network access: https://%s%s\n",
		s.config.Server.HTTPSPort, host, s.config.Server.HTTPSPort)

	return s.router.RunTLS(s.config.Server.HTTPSPort, s.config.Server.TLS.CertFile, s.config.Server.TLS.KeyFile)
}

// startBoth 启动模式3：HTTP和HTTPS都启动
func (s *Server) startBoth(host string) error {
	if err := s.validateTLSConfig(); err != nil {
		return fmt.Errorf("HTTPS configuration error: %v", err)
	}

	fmt.Printf("Startup Mode: HTTP and HTTPS Both\n")
	fmt.Printf("Service accessible at:\n- HTTP Local access: http://localhost%s\n- HTTP Network access: http://%s%s\n- HTTPS Local access: https://localhost%s\n- HTTPS Network access: https://%s%s\n",
		s.config.Server.HTTPPort, host, s.config.Server.HTTPPort,
		s.config.Server.HTTPSPort, host, s.config.Server.HTTPSPort)

	// 启动HTTP服务（在goroutine中）
	go func() {
		if err := s.router.Run(s.config.Server.HTTPPort); err != nil {
			s.logger.Error("HTTP service startup failed", zap.Error(err))
		}
	}()

	// 启动HTTPS服务（主线程）
	return s.router.RunTLS(s.config.Server.HTTPSPort, s.config.Server.TLS.CertFile, s.config.Server.TLS.KeyFile)
}

// startHTTPSRedirect 启动模式4：强制HTTPS，HTTP重定向
func (s *Server) startHTTPSRedirect(host string) error {
	if err := s.validateTLSConfig(); err != nil {
		return fmt.Errorf("HTTPS configuration error: %v", err)
	}

	fmt.Printf("Startup Mode: HTTPS Redirect (HTTP redirects to HTTPS)\n")
	fmt.Printf("Service accessible at:\n- HTTPS Local access: https://localhost%s\n- HTTPS Network access: https://%s%s\n- HTTP requests will be redirected to HTTPS\n",
		s.config.Server.HTTPSPort, host, s.config.Server.HTTPSPort)

	// 创建HTTP重定向服务器
	redirectServer := &http.Server{
		Addr: s.config.Server.HTTPPort,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 构建HTTPS URL
			httpsPort := strings.TrimPrefix(s.config.Server.HTTPSPort, ":")
			var httpsURL string
			if httpsPort == "443" {
				httpsURL = "https://" + r.Host + r.RequestURI
			} else {
				// 移除可能存在的端口号，然后添加HTTPS端口
				hostWithoutPort := strings.Split(r.Host, ":")[0]
				httpsURL = fmt.Sprintf("https://%s:%s%s", hostWithoutPort, httpsPort, r.RequestURI)
			}

			http.Redirect(w, r, httpsURL, http.StatusMovedPermanently)
		}),
	}

	// 启动HTTP重定向服务（在goroutine中）
	go func() {
		if err := redirectServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Error("HTTP redirect service startup failed", zap.Error(err))
		}
	}()

	// 启动HTTPS服务（主线程）
	return s.router.RunTLS(s.config.Server.HTTPSPort, s.config.Server.TLS.CertFile, s.config.Server.TLS.KeyFile)
}

// startDefault 启动模式5：默认启动（只有HTTP）
func (s *Server) startDefault(host string) error {
	fmt.Printf("Startup Mode: Default (HTTP Only)\n")
	fmt.Printf("Service accessible at:\n- Local access: http://localhost%s\n- Network access: http://%s%s\n",
		s.config.Server.HTTPPort, host, s.config.Server.HTTPPort)

	return s.router.Run(s.config.Server.HTTPPort)
}

// validateTLSConfig 验证TLS配置
func (s *Server) validateTLSConfig() error {
	if s.config.Server.TLS.CertFile == "" {
		return fmt.Errorf("TLS certificate file path cannot be empty")
	}
	if s.config.Server.TLS.KeyFile == "" {
		return fmt.Errorf("TLS private key file path cannot be empty")
	}

	// 检查证书文件是否存在
	if _, err := os.Stat(s.config.Server.TLS.CertFile); os.IsNotExist(err) {
		return fmt.Errorf("TLS certificate file does not exist: %s", s.config.Server.TLS.CertFile)
	}

	// 检查私钥文件是否存在
	if _, err := os.Stat(s.config.Server.TLS.KeyFile); os.IsNotExist(err) {
		return fmt.Errorf("TLS private key file does not exist: %s", s.config.Server.TLS.KeyFile)
	}

	// 验证证书和私钥是否匹配
	_, err := tls.LoadX509KeyPair(s.config.Server.TLS.CertFile, s.config.Server.TLS.KeyFile)
	if err != nil {
		return fmt.Errorf("TLS certificate and private key do not match: %v", err)
	}

	return nil
}

// 获取当前 IP
func getLocalIP() (string, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "localhost", err
	}

	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipv4 := ipnet.IP.To4(); ipv4 != nil {
				// 跳过169.254.x.x的APIPA地址
				if !ipv4.IsLinkLocalUnicast() {
					return ipv4.String(), nil
				}
			}
		}
	}
	return "localhost", nil
}
