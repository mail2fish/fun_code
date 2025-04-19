package service

// I18nService 定义了国际化服务的接口
type I18nService interface {
	// Translate 根据给定的消息ID和语言翻译消息
	Translate(messageID string, lang string) string
	
	// TranslateWithData 根据给定的消息ID、语言和模板数据翻译消息
	TranslateWithData(messageID string, lang string, templateData map[string]interface{}) string
	
	// GetDefaultLanguage 获取默认语言
	GetDefaultLanguage() string
	
	// GetSupportedLanguages 获取支持的语言列表
	GetSupportedLanguages() []string
}