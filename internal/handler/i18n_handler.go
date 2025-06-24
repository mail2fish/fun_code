package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/mail2fish/gorails/gorails"
)

// GetSupportedLanguagesParams 获取支持的语言列表请求参数
type GetSupportedLanguagesParams struct {
	// 无需参数
}

func (p *GetSupportedLanguagesParams) Parse(c *gin.Context) gorails.Error {
	// 无需解析参数
	return nil
}

// GetSupportedLanguagesResponse 获取支持的语言列表响应
type GetSupportedLanguagesResponse struct {
	Languages   []string `json:"languages"`
	DefaultLang string   `json:"default_lang"`
	CurrentLang string   `json:"current_lang"`
}

// GetSupportedLanguagesHandler 获取支持的语言列表 gorails.Wrap 形式
func (h *Handler) GetSupportedLanguagesHandler(c *gin.Context, params *GetSupportedLanguagesParams) (*GetSupportedLanguagesResponse, *gorails.ResponseMeta, gorails.Error) {
	languages := h.i18n.GetSupportedLanguages()
	defaultLang := h.i18n.GetDefaultLanguage()

	return &GetSupportedLanguagesResponse{
		Languages:   languages,
		DefaultLang: defaultLang,
		CurrentLang: h.GetLanguage(c),
	}, nil, nil
}

// SetLanguageParams 设置语言请求参数
type SetLanguageParams struct {
	Language string `json:"language" binding:"required"`
}

func (p *SetLanguageParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_AUTH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// SetLanguageResponse 设置语言响应
type SetLanguageResponse struct {
	Message  string `json:"message"`
	Language string `json:"language"`
}

// SetLanguageHandler 设置语言 gorails.Wrap 形式
func (h *Handler) SetLanguageHandler(c *gin.Context, params *SetLanguageParams) (*SetLanguageResponse, *gorails.ResponseMeta, gorails.Error) {
	// 检查语言是否受支持
	supported := false
	for _, lang := range h.i18n.GetSupportedLanguages() {
		if lang == params.Language {
			supported = true
			break
		}
	}

	if !supported {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_AUTH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	// 设置语言 Cookie
	c.SetCookie(
		"lang",
		params.Language,
		60*60*24*30, // 30天有效期
		"/",
		"",
		false,
		false,
	)

	return &SetLanguageResponse{
		Message:  "语言设置成功",
		Language: params.Language,
	}, nil, nil
}

// 保留原有的旧handler以保持兼容性（可以逐步迁移）
// GetSupportedLanguages 获取支持的语言列表
func (h *Handler) GetSupportedLanguages(c *gin.Context) {
	languages := h.i18n.GetSupportedLanguages()
	defaultLang := h.i18n.GetDefaultLanguage()

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
	for _, lang := range h.i18n.GetSupportedLanguages() {
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
