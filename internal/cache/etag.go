package cache

import (
	"fmt"
	// Import time for cache constants like NoExpiration
	"github.com/patrickmn/go-cache" // Import go-cache for NoExpiration constant
)

// ETagCache 定义 ETag 缓存接口
type ETagCache interface {
	GetETag(key string) (string, bool) // 返回 etag 和是否找到
	SetETag(key string, etag string)
	DeleteETag(key string)
}

// ETagCacheImpl 实现基于通用 Cache 的 ETag 缓存
type ETagCacheImpl struct {
	cache Cache // 使用通用的 Cache 接口
}

// NewETagCache 创建一个新的 ETag 缓存实例
func NewETagCache(cache Cache) ETagCache {
	return &ETagCacheImpl{
		cache: cache,
	}
}

// GetETag 从缓存获取 ETag
func (c *ETagCacheImpl) GetETag(key string) (string, bool) {
	cacheKey := fmt.Sprintf("etag:%s", key)
	data, found := c.cache.Get(cacheKey)
	if !found {
		return "", false
	}

	etag, ok := data.(string) // ETag 存储为字符串
	return etag, ok
}

// SetETag 将 ETag 存入缓存
// ETags 通常与文件内容关联，文件不变则 ETag 不变，因此可以设置较长或无过期时间
func (c *ETagCacheImpl) SetETag(key string, etag string) {
	cacheKey := fmt.Sprintf("etag:%s", key)
	// 使用 cache.NoExpiration 表示永不过期（除非手动删除或缓存被清除）
	// 或者可以设置一个非常长的过期时间，例如 24 * 30 * time.Hour
	c.cache.Set(cacheKey, etag, cache.NoExpiration)
}

// DeleteETag 从缓存中删除 ETag
func (c *ETagCacheImpl) DeleteETag(key string) {
	cacheKey := fmt.Sprintf("etag:%s", key)
	c.cache.Delete(cacheKey)
}
