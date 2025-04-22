package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/dao"
	"github.com/jun/fun_code/internal/i18n"
	"go.uber.org/zap"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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

func (h *Handler) CreateDirectory(c *gin.Context) {
	userID := c.GetUint("userID")
	var req struct {
		Name     string `json:"name" binding:"required"`
		ParentID *uint  `json:"parent_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数无效"})
		return
	}

	if err := h.dao.FileDao.CreateDirectory(userID, req.Name, req.ParentID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建目录失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "目录创建成功"})
}

func (h *Handler) UploadFile(c *gin.Context) {
	userID := c.GetUint("userID")
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未找到上传文件"})
		return
	}

	parentIDStr := c.PostForm("parent_id")
	var parentID *uint
	if parentIDStr != "" {
		id, err := strconv.ParseUint(parentIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的父目录ID"})
			return
		}
		uintID := uint(id)
		parentID = &uintID
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "打开文件失败"})
		return
	}
	defer src.Close()

	contentType := file.Header.Get("Content-Type")
	if err := h.dao.FileDao.UploadFile(userID, file.Filename, parentID, contentType, file.Size, src); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "上传文件失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "文件上传成功"})
}

func (h *Handler) ListFiles(c *gin.Context) {
	userID := c.GetUint("userID")
	parentIDStr := c.Query("parent_id")

	var parentID *uint
	if parentIDStr != "" {
		id, err := strconv.ParseUint(parentIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的父目录ID"})
			return
		}
		uintID := uint(id)
		parentID = &uintID
	}

	files, err := h.dao.FileDao.ListFiles(userID, parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取文件列表失败"})
		return
	}

	c.JSON(http.StatusOK, files)
}

func (h *Handler) DownloadFile(c *gin.Context) {
	userID := c.GetUint("userID")
	fileID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的文件ID"})
		return
	}

	file, err := h.dao.FileDao.GetFile(userID, uint(fileID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if file.IsDirectory {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不能下载目录"})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", file.Name))
	c.Header("Content-Type", file.ContentType)
	c.File(file.Path)
}

func (h *Handler) DeleteFile(c *gin.Context) {
	userID := c.GetUint("userID")
	fileID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的文件ID"})
		return
	}

	if err := h.dao.FileDao.DeleteFile(userID, uint(fileID)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "文件不存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "文件删除成功"})
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
