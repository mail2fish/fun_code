package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/server"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var rootCmd = &cobra.Command{
	Use:   "fun_code",
	Short: "A web-based scratch backend system",
	Long: `Fun Code is a web-based scratch backend system that provides:
- Scratch project user management
- Scratch project management
`,
}

const defaultBaseDir = "funcode_server"

var defaultConfigPath = filepath.Join(defaultBaseDir, "config", "config.yaml")

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the web server",
	Run: func(cmd *cobra.Command, args []string) {
		// 获取配置文件路径
		configPath, err := cmd.Flags().GetString("config")
		if err != nil {
			fmt.Printf("Failed to get config file path: %v\n", err)
			os.Exit(1)
		}

		// If no explicit config file path is provided, and the default config file defaultConfigPath does not exist,
		// create it in the user's home directory.
		if configPath == "" || configPath == defaultConfigPath {
			if _, err = os.Stat(defaultConfigPath); err == nil {
				configPath = defaultConfigPath
			} else {
				// If the config file does not exist, create a default config file
				cfg := config.NewConfig(defaultBaseDir)
				if err = cfg.Save(defaultConfigPath); err != nil {
					fmt.Printf("Failed to create default config file: %v\n", err)
					os.Exit(1)
				}
				// Print the config file path and notify the user in English
				fmt.Printf("Config file created at: %s\n", defaultConfigPath)
				configPath = defaultConfigPath
			}
		}

		// 加载配置
		cfg, err := config.LoadConfig(configPath)
		if err != nil {
			fmt.Printf("加载配置失败: %v\n", err)
			os.Exit(1)
		}

		// 初始化 zap logger, 用于日志记录,根据 cfg 区分不同环境
		var logger *zap.Logger
		var logLevel zapcore.Level
		switch cfg.Logger.Level { // 假设 cfg.LogLevel 是字符串，比如 "info", "debug", "warn"
		case "debug":
			logLevel = zapcore.DebugLevel
		case "warn":
			logLevel = zapcore.WarnLevel
		case "error":
			logLevel = zapcore.ErrorLevel
		default:
			logLevel = zapcore.InfoLevel
		}

		var writeSyncer zapcore.WriteSyncer
		if cfg.Logger.Output == "stdout" {
			writeSyncer = zapcore.AddSync(os.Stdout)
		} else {
			logFile := filepath.Join(cfg.Logger.Directory, cfg.Logger.Output)
			fileWriter, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err != nil {
				fmt.Println("无法打开日志文件:", err)
				os.Exit(1)
			}
			writeSyncer = zapcore.AddSync(fileWriter)
		}

		encoderConfig := zap.NewProductionEncoderConfig()
		core := zapcore.NewCore(
			zapcore.NewJSONEncoder(encoderConfig),
			writeSyncer,
			logLevel,
		)
		logger = zap.New(core)
		defer logger.Sync()

		// 初始化服务器
		srv, err := server.NewServer(cfg, logger)
		if err != nil {
			fmt.Println("Failed to initialize server:", err)
			logger.Sync()
			os.Exit(1)
		}

		// 启动服务
		if err := srv.Start(); err != nil {
			fmt.Printf("服务器启动失败: %v\n", err)
			logger.Sync()
			os.Exit(1)
		}
	},
}

func init() {
	rootCmd.PersistentFlags().StringP("config", "c", defaultConfigPath, "config file path")
	rootCmd.AddCommand(serveCmd)
	rootCmd.Run = serveCmd.Run // 设置 serveCmd 为默认命令
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
