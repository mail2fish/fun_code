package cache

import (
	"fmt"
	"time"

	"github.com/jun/fun_code/internal/model"
)

// SessionCache 定义会话缓存接口
type SessionCache interface {
	GetSession(userID uint) (*model.UserSession, bool)
	SetSession(session *model.UserSession)
	DeleteSession(userID uint)
}

// UserSessionCache 实现基于内存的会话缓存
type UserSessionCache struct {
	cache Cache
}

// NewUserSessionCache 创建一个新的会话缓存实例
func NewUserSessionCache(cache Cache) SessionCache {
	return &UserSessionCache{
		cache: cache,
	}
}

// GetSession 从缓存获取用户会话
func (c *UserSessionCache) GetSession(userID uint) (*model.UserSession, bool) {
	key := fmt.Sprintf("session:%d", userID)
	data, found := c.cache.Get(key)
	if !found {
		return nil, false
	}

	session, ok := data.(*model.UserSession)
	return session, ok
}

// SetSession 将用户会话存入缓存
func (c *UserSessionCache) SetSession(session *model.UserSession) {
	if session == nil {
		return
	}

	key := fmt.Sprintf("session:%d", session.UserID)
	// 计算过期时间
	expiration := time.Until(session.ExpiresAt)
	if expiration <= 0 {
		// 如果已过期，不缓存
		return
	}

	c.cache.Set(key, session, expiration)
}

// DeleteSession 从缓存中删除用户会话
func (c *UserSessionCache) DeleteSession(userID uint) {
	key := fmt.Sprintf("session:%d", userID)
	c.cache.Delete(key)
}
