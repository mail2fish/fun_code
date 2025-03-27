package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoadConfig(t *testing.T) {
	// 创建临时目录用于测试
	tempDir := t.TempDir()

	tests := []struct {
		name      string
		content   string
		wantErr   bool
		validate  func(*testing.T, *Config)
	}{
		{
			name: "有效配置",
			content: `database:
  dsn: test.db
  driver: sqlite
storage:
  basePath: /tmp/storage
jwt:
  secretKey: test_secret_key
server:
  port: :8080`,
			wantErr: false,
			validate: func(t *testing.T, cfg *Config) {
				assert.Equal(t, "test.db", cfg.Database.DSN)
				assert.Equal(t, "sqlite", cfg.Database.Driver)
				assert.Equal(t, "/tmp/storage", cfg.Storage.BasePath)
				assert.Equal(t, "test_secret_key", cfg.JWT.SecretKey)
				assert.Equal(t, ":8080", cfg.Server.Port)
			},
		},
		{
			name: "缺少必要字段",
			content: `database:
  dsn: test.db`,
			wantErr: true,
			validate: func(t *testing.T, cfg *Config) {
				assert.Nil(t, cfg)
			},
		},
		{
			name: "无效的YAML格式",
			content: `database:
  dsn: test.db
  driver: [invalid`,
			wantErr: true,
			validate: func(t *testing.T, cfg *Config) {
				assert.Nil(t, cfg)
			},
		},
		{
			name: "配置文件不存在",
			content: "",
			wantErr: true,
			validate: func(t *testing.T, cfg *Config) {
				assert.Nil(t, cfg)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var configPath string
			if tt.name == "配置文件不存在" {
				configPath = filepath.Join(tempDir, "nonexistent.yaml")
			} else {
				// 创建临时配置文件
				configPath = filepath.Join(tempDir, "config.yaml")
				err := os.WriteFile(configPath, []byte(tt.content), 0644)
				assert.NoError(t, err)
			}

			// 加载配置
			cfg, err := LoadConfig(configPath)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, cfg)
			}

			// 验证配置
			tt.validate(t, cfg)
		})
	}
}

func TestNewConfig(t *testing.T) {
	cfg := NewConfig()
	assert.NotNil(t, cfg)
	assert.Equal(t, ":8080", cfg.Server.Port)
	assert.Equal(t, "sqlite", cfg.Database.Driver)
	assert.Equal(t, "fun_code.db", cfg.Database.DSN)
	assert.Equal(t, "your-secret-key", cfg.JWT.SecretKey)
	assert.Equal(t, filepath.Join(os.TempDir(), "fun_code_files"), cfg.Storage.BasePath)
}

func TestConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  *Config
		wantErr bool
	}{
		{
			name: "有效配置",
			config: &Config{
				Database: DatabaseConfig{
					Driver: "sqlite",
					DSN:    "test.db",
				},
				Storage: StorageConfig{
					BasePath: "/tmp/storage",
				},
				JWT: JWTConfig{
					SecretKey: "test_secret_key",
				},
				Server: ServerConfig{
					Port: ":8080",
				},
			},
			wantErr: false,
		},
		{
			name: "数据库DSN为空",
			config: &Config{
				Database: DatabaseConfig{
					Driver: "sqlite",
					DSN:    "",
				},
				Storage: StorageConfig{
					BasePath: "/tmp/storage",
				},
				JWT: JWTConfig{
					SecretKey: "test_secret_key",
				},
				Server: ServerConfig{
					Port: ":8080",
				},
			},
			wantErr: true,
		},
		{
			name: "存储路径为空",
			config: &Config{
				Database: DatabaseConfig{
					Driver: "sqlite",
					DSN:    "test.db",
				},
				Storage: StorageConfig{
					BasePath: "",
				},
				JWT: JWTConfig{
					SecretKey: "test_secret_key",
				},
				Server: ServerConfig{
					Port: ":8080",
				},
			},
			wantErr: true,
		},
		{
			name: "JWT密钥为空",
			config: &Config{
				Database: DatabaseConfig{
					Driver: "sqlite",
					DSN:    "test.db",
				},
				Storage: StorageConfig{
					BasePath: "/tmp/storage",
				},
				JWT: JWTConfig{
					SecretKey: "",
				},
				Server: ServerConfig{
					Port: ":8080",
				},
			},
			wantErr: true,
		},
		{
			name: "数据库驱动为空",
			config: &Config{
				Database: DatabaseConfig{
					Driver: "",
					DSN:    "test.db",
				},
				Storage: StorageConfig{
					BasePath: "/tmp/storage",
				},
				JWT: JWTConfig{
					SecretKey: "test_secret_key",
				},
				Server: ServerConfig{
					Port: ":8080",
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}