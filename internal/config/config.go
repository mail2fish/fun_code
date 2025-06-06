package config

import (
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"text/template"

	_ "embed"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

//go:embed config.yaml.template
var ConfigTemplate string

type DatabaseConfig struct {
	Driver string `yaml:"driver"`
	DSN    string `yaml:"dsn"`
}

type StorageConfig struct {
	BasePath string `yaml:"basePath"`
}

type JWTConfig struct {
	SecretKey string `yaml:"secretKey"`
}

// ServerMode 服务器启动模式
type ServerMode string

const (
	// ModeHTTPOnly 只启动HTTP服务
	ModeHTTPOnly ServerMode = "http_only"
	// ModeHTTPSOnly 只启动HTTPS服务
	ModeHTTPSOnly ServerMode = "https_only"
	// ModeBoth HTTP和HTTPS都启动
	ModeBoth ServerMode = "both"
	// ModeHTTPSRedirect HTTP重定向到HTTPS
	ModeHTTPSRedirect ServerMode = "https_redirect"
	// ModeDefault 默认模式（只有HTTP）
	ModeDefault ServerMode = "default"
)

type TLSConfig struct {
	CertFile string `yaml:"cert_file"`
	KeyFile  string `yaml:"key_file"`
}

type ServerConfig struct {
	Mode      ServerMode `yaml:"mode"`       // 启动模式
	HTTPPort  string     `yaml:"http_port"`  // HTTP端口
	HTTPSPort string     `yaml:"https_port"` // HTTPS端口
	TLS       TLSConfig  `yaml:"tls"`        // TLS证书配置

	// 兼容旧配置
	Port string `yaml:"port"`
}

type ScratchEditorConfig struct {
	Host                 string `yaml:"host"`
	CreateProjectLimiter int    `yaml:"create_project_limiter"`
}

// 在现有的 config.go 文件中添加 I18n 配置

// I18nConfig 国际化配置
type I18nConfig struct {
	LocalesPath string `yaml:"locales_path"`
	DefaultLang string `yaml:"default_lang"`
}

type Protected struct {
	Users    []uint `yaml:"users"`
	Projects []uint `yaml:"projects"`
}

type LoggerConfig struct {
	Level     string `yaml:"level"`
	Directory string `yaml:"directory"` // 日志文件存储目录
	Output    string `yaml:"output"`    // 日志输出方式，可选值为 "stdout" 和 "file"
}

// Config 应用配置
type Config struct {
	Version       int                 `yaml:"version"`
	Env           string              `yaml:"env"`
	Protected     Protected           `yaml:"protected"`
	AdminPassword string              `yaml:"admin_password"`
	Database      DatabaseConfig      `yaml:"database"`
	Storage       StorageConfig       `yaml:"storage"`
	JWT           JWTConfig           `yaml:"jwt"`
	Server        ServerConfig        `yaml:"server"`
	ScratchEditor ScratchEditorConfig `yaml:"scratch_editor"`
	I18n          I18nConfig          `yaml:"i18n"`
	Logger        LoggerConfig        `yaml:"logger"` // 新增 Logger 配置
}

func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func NewConfig(baseDir string) *Config {

	// 从 8080 开始，依次尝试 TCP 端口号是否可用
	port := 8080
	// var listenAddr string
	for ; port <= 8089; port++ {
		addr := fmt.Sprintf(":%d", port)
		listener, err := net.Listen("tcp", addr)
		if err != nil {
			continue
		}
		// 获取监听的 IP 地址
		// host := "localhost"
		// if addrs, err := net.InterfaceAddrs(); err == nil {
		// 	for _, addr := range addrs {
		// 		// 检查IP地址
		// 		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
		// 			if ipnet.IP.To4() != nil {
		// 				host = ipnet.IP.String()
		// 				break
		// 			}
		// 		}
		// 	}
		// }
		// listenAddr = host
		// 关闭监听
		listener.Close()

		break
	}

	// 生成随机密钥
	secretKey := uuid.New().String()
	listenPort := fmt.Sprintf(":%d", port)
	// host := fmt.Sprintf("http://%s:%d", listenAddr, port)

	password := uuid.New().String()[:8]

	return &Config{
		Env: "production",
		// Env:           "development",
		// Env:           "demo",
		AdminPassword: password,
		Protected: Protected{
			Users: []uint{1},
		},
		Database: DatabaseConfig{
			Driver: "sqlite",
			DSN:    filepath.Join(baseDir, "sqlite", "fun_code.db"),
		},
		Storage: StorageConfig{
			BasePath: filepath.Join(baseDir, "data", "upload_files"),
		},
		JWT: JWTConfig{
			SecretKey: secretKey,
		},
		Server: ServerConfig{
			Mode:      ModeDefault,
			HTTPPort:  listenPort,
			HTTPSPort: ":8443",
			Port:      listenPort, // 兼容旧配置
			TLS: TLSConfig{
				CertFile: "",
				KeyFile:  "",
			},
		},
		ScratchEditor: ScratchEditorConfig{
			// Host:                 host,
			CreateProjectLimiter: 3,
		},
		Logger: LoggerConfig{
			Level:     "error",
			Directory: filepath.Join(baseDir, "logs"),
			Output:    "stdout",
		},
	}
}

func initDir(path string) error {
	// 文件夹不存在则创建
	dir := filepath.Dir(path)
	currentDir, err := os.Getwd()
	if err != nil {
		return err
	}
	fmt.Printf("Initializing directory: %s\n", filepath.Join(currentDir, dir))
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

func (c *Config) Save(path string) error {
	// 初始化 config 文件夹
	if err := initDir(path); err != nil {
		return err
	}

	// 初始化 sqlite 文件夹
	if err := initDir(c.Database.DSN); err != nil {
		return err
	}
	// 初始化 data 文件夹
	if err := initDir(c.Storage.BasePath); err != nil {
		return err
	}
	// 初始化 logs 文件夹
	if err := initDir(c.Logger.Directory); err != nil {
		return err
	}

	// 文件不存在则创建, 基于 config.yaml.template
	if _, err := os.Stat(path); os.IsNotExist(err) {
		// 加载模版
		template, err := template.New("config").Parse(ConfigTemplate)
		if err != nil {
			return err
		}
		// 渲染模版，并写入文件
		file, err := os.Create(path)
		if err != nil {
			return err
		}
		defer file.Close()
		err = template.Execute(file, c)
		if err != nil {
			fmt.Println("render template error", err.Error())
			return err
		}
	}

	// Print the config file path and notify the user in English
	fmt.Printf("Config file created at: %s\n", path)

	// 输出默认 admin 密码
	// Print default admin password and indicate where to find it
	fmt.Printf("Default admin password: %s (You can also find it in config.yaml file)\n", c.AdminPassword)

	return nil
}

func (c *Config) Validate() error {
	if c.Database.Driver == "" {
		return errors.New("数据库驱动不能为空")
	}
	if c.Database.DSN == "" {
		return errors.New("数据库DSN不能为空")
	}
	if c.Storage.BasePath == "" {
		return errors.New("存储路径不能为空")
	}
	if c.JWT.SecretKey == "" {
		return errors.New("JWT密钥不能为空")
	}
	return nil
}
