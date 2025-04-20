package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetSupportedLanguages 获取支持的语言列表
func (h *Handler) GetSupportedLanguages(c *gin.Context) {
	languages := h.services.I18nDao.GetSupportedLanguages()
	defaultLang := h.services.I18nDao.GetDefaultLanguage()

	c.JSON(http.StatusOK, gin.H{
		"languages":    languages,
		"default_lang": defaultLang,
		"current_lang": h.GetLanguage(c),
	})
}

// SetLanguage 设置语言
func (h *Handler) SetLanguage(c *gin.Context) {
	var req struct {
		Language string `json:"language" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的语言设置请求",
		})
		return
	}

	// 检查语言是否受支持
	supported := false
	for _, lang := range h.services.I18nDao.GetSupportedLanguages() {
		if lang == req.Language {
			supported = true
			break
		}
	}

	if !supported {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "不支持的语言",
		})
		return
	}

	// 设置语言 Cookie
	c.SetCookie(
		"lang",
		req.Language,
		60*60*24*30, // 30天有效期
		"/",
		"",
		false,
		false,
	)

	c.JSON(http.StatusOK, gin.H{
		"message":  "语言设置成功",
		"language": req.Language,
	})
}
