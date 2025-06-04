package handler

import (
	"strings"
	"sync"
	"time"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/dao"
	"github.com/jun/fun_code/internal/i18n"
	"go.uber.org/zap"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	dao    *dao.Dao
	config *config.Config   // 添加配置字段
	i18n   i18n.I18nService // 新增 I18nService

	// 用于限流的映射和互斥锁
	createProjectLimiter     map[uint][]time.Time
	createProjectLimiterLock sync.Mutex
	logger                   *zap.Logger
}

func NewHandler(dao *dao.Dao, i18n i18n.I18nService, logger *zap.Logger,
	cfg *config.Config) *Handler {
	return &Handler{
		dao:                  dao,
		i18n:                 i18n,
		config:               cfg, // 初始化配置字段
		createProjectLimiter: make(map[uint][]time.Time),
		logger:               logger,
	}
}

// 在 Handler 结构体中添加 i18n 相关方法

// T 翻译消息
func (h *Handler) T(messageID string, c *gin.Context) string {
	lang := h.GetLanguage(c)
	return h.i18n.Translate(messageID, lang)
}

// TWithData 使用模板数据翻译消息
func (h *Handler) TWithData(messageID string, c *gin.Context, data map[string]interface{}) string {
	lang := h.GetLanguage(c)
	return h.i18n.TranslateWithData(messageID, lang, data)
}

// GetLanguage 从请求中获取语言
func (h *Handler) GetLanguage(c *gin.Context) string {
	// 优先从查询参数获取
	lang := c.Query("lang")
	if lang != "" {
		return lang
	}

	// 其次从 Cookie 获取
	langCookie, err := c.Cookie("lang")
	if err == nil && langCookie != "" {
		return langCookie
	}

	// 最后从 Accept-Language 头获取
	acceptLang := c.GetHeader("Accept-Language")
	if acceptLang != "" {
		// 简单处理，取第一个语言代码
		parts := strings.Split(acceptLang, ",")
		if len(parts) > 0 {
			langCode := strings.Split(parts[0], ";")[0]
			return langCode
		}
	}

	// 默认返回配置的默认语言
	return h.i18n.GetDefaultLanguage()
}
