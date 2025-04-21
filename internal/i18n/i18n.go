package i18n

import (
	// 保持导入，以防万一 RegisterUnmarshalFunc 需要它作为默认
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"
	"gopkg.in/yaml.v3" // 导入 YAML 包
)

// I18nServiceImpl 实现了 I18nService 接口
type I18nServiceImpl struct {
	bundle          *i18n.Bundle
	defaultLanguage string
	localizer       map[string]*i18n.Localizer
	supportedLangs  []string
}

// NewI18nService 创建一个新的 I18nService 实例
func NewI18nService(localesPath string, defaultLang string) (I18nService, error) {
	bundle := i18n.NewBundle(language.Make(defaultLang))
	// 注册 YAML 的 unmarshal 函数
	bundle.RegisterUnmarshalFunc("yaml", yaml.Unmarshal)

	// 读取语言文件
	files, err := os.ReadDir(localesPath)
	if err != nil {
		return nil, err
	}

	localizers := make(map[string]*i18n.Localizer)
	supportedLangs := []string{defaultLang}

	// 加载所有语言文件
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// 修改后缀检查为 .yaml
		if strings.HasSuffix(file.Name(), ".yaml") {
			langFile := filepath.Join(localesPath, file.Name())
			// LoadMessageFile 会自动使用注册的 unmarshal 函数
			_, err := bundle.LoadMessageFile(langFile)
			if err != nil {
				log.Printf("加载语言文件 %s 失败: %v", langFile, err)
				continue
			}

			// 从文件名中提取语言代码 (例如 zh-CN.yaml -> zh-CN)
			lang := strings.TrimSuffix(file.Name(), filepath.Ext(file.Name()))
			if lang != defaultLang {
				supportedLangs = append(supportedLangs, lang)
			}

			// 为每种语言创建一个 localizer
			localizers[lang] = i18n.NewLocalizer(bundle, lang)
		}
	}

	// 确保默认语言的 localizer 存在
	if _, ok := localizers[defaultLang]; !ok {
		localizers[defaultLang] = i18n.NewLocalizer(bundle, defaultLang)
	}

	return &I18nServiceImpl{
		bundle:          bundle,
		defaultLanguage: defaultLang,
		localizer:       localizers,
		supportedLangs:  supportedLangs,
	}, nil
}

// Translate 根据给定的消息ID和语言翻译消息
func (s *I18nServiceImpl) Translate(messageID string, lang string) string {
	return s.TranslateWithData(messageID, lang, nil)
}

// TranslateWithData 根据给定的消息ID、语言和模板数据翻译消息
func (s *I18nServiceImpl) TranslateWithData(messageID string, lang string, templateData map[string]interface{}) string {
	// 如果语言不受支持，使用默认语言
	localizer, ok := s.localizer[lang]
	if !ok {
		localizer = s.localizer[s.defaultLanguage]
	}

	// 翻译消息
	msg, err := localizer.Localize(&i18n.LocalizeConfig{
		MessageID:    messageID,
		TemplateData: templateData,
	})

	if err != nil {
		log.Printf("翻译消息 %s 失败: %v", messageID, err)
		return messageID // 如果翻译失败，返回原始消息ID
	}

	return msg
}

// GetDefaultLanguage 获取默认语言
func (s *I18nServiceImpl) GetDefaultLanguage() string {
	return s.defaultLanguage
}

// GetSupportedLanguages 获取支持的语言列表
func (s *I18nServiceImpl) GetSupportedLanguages() []string {
	return s.supportedLangs
}
