package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/jun/fun_code/internal/config"
	"github.com/jun/fun_code/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	services service.Services
	config   *config.Config // 添加配置字段

	// 用于限流的映射和互斥锁
	createProjectLimiter     map[uint][]time.Time
	createProjectLimiterLock sync.Mutex
}

func NewHandler(services service.Services,
	cfg *config.Config) *Handler {
	return &Handler{
		services:             services,
		config:               cfg, // 初始化配置字段
		createProjectLimiter: make(map[uint][]time.Time),
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

	if err := h.services.FileService.CreateDirectory(userID, req.Name, req.ParentID); err != nil {
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
	if err := h.services.FileService.UploadFile(userID, file.Filename, parentID, contentType, file.Size, src); err != nil {
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

	files, err := h.services.FileService.ListFiles(userID, parentID)
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

	file, err := h.services.FileService.GetFile(userID, uint(fileID))
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

	if err := h.services.FileService.DeleteFile(userID, uint(fileID)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "文件不存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "文件删除成功"})
}
