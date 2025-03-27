package config

import (
	"errors"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

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

type ServerConfig struct {
	Port string `yaml:"port"`
}

type Config struct {
	Database DatabaseConfig `yaml:"database"`
	Storage  StorageConfig  `yaml:"storage"`
	JWT      JWTConfig     `yaml:"jwt"`
	Server   ServerConfig  `yaml:"server"`
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

func NewConfig() *Config {
	return &Config{
		Database: DatabaseConfig{
			Driver: "sqlite",
			DSN:    "fun_code.db",
		},
		Storage: StorageConfig{
			BasePath: filepath.Join(os.TempDir(), "fun_code_files"),
		},
		JWT: JWTConfig{
			SecretKey: "your-secret-key",
		},
		Server: ServerConfig{
			Port: ":8080",
		},
	}
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