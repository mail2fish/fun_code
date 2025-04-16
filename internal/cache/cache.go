package cache

import (
	"time"

	"github.com/patrickmn/go-cache"
)

// Cache 接口定义了缓存的基本操作
type Cache interface {
	Set(key string, value interface{}, expiration time.Duration)
	Get(key string) (interface{}, bool)
	Delete(key string)
}

// GoCache 是基于 go-cache 的缓存实现
type GoCache struct {
	client *cache.Cache
}

// NewGoCache 创建一个新的 GoCache 实例
func NewGoCache() *GoCache {
	// 创建一个默认过期时间为5分钟，每10分钟清理一次过期项的缓存
	c := cache.New(60*time.Minute, 10*time.Minute)
	return &GoCache{
		client: c,
	}
}

// Set 设置缓存项
func (c *GoCache) Set(key string, value interface{}, expiration time.Duration) {
	c.client.Set(key, value, expiration)
}

// Get 获取缓存项
func (c *GoCache) Get(key string) (interface{}, bool) {
	return c.client.Get(key)
}

// Delete 删除缓存项
func (c *GoCache) Delete(key string) {
	c.client.Delete(key)
}
