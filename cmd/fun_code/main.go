package main

import (
	"fmt"
	"os"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/server"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "fun_code",
	Short: "A file management system with user authentication",
	Long: `Fun Code is a web-based file management system that provides:
- User registration and authentication
- File upload and download
- Directory management
- File listing and organization`,
}

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the web server",
	Run: func(cmd *cobra.Command, args []string) {
		// 获取配置文件路径
		configPath, err := cmd.Flags().GetString("config")
		if err != nil {
			fmt.Printf("获取配置文件路径失败: %v\n", err)
			os.Exit(1)
		}

		// 加载配置
		cfg, err := config.LoadConfig(configPath)
		if err != nil {
			fmt.Printf("加载配置失败: %v\n", err)
			os.Exit(1)
		}

		// 初始化服务器
		srv, err := server.NewServer(cfg)
		if err != nil {
			fmt.Printf("初始化服务器失败: %v\n", err)
			os.Exit(1)
		}

		// 启动服务
		if err := srv.Start(); err != nil {
			fmt.Printf("服务器启动失败: %v\n", err)
			os.Exit(1)
		}
	},
}

func init() {
	serveCmd.Flags().IntP("port", "p", 8080, "服务器监听端口")
	serveCmd.Flags().StringP("config", "c", "./config.yaml", "配置文件路径")
	rootCmd.AddCommand(serveCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
