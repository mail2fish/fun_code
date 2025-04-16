package handler

import (
	"encoding/json"
	"html/template"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/web"
)

// NewScratchProject 创建一个新的Scratch项目处理程序
// 从 web package 的 GetScratchIndexHTML 方法获取 HTML 模版内容
// 通过 html/template 包 tmpl.Execute, 注入数据 ProjectID string,AssetHost string
// AssetHost 从 config/config.go 中获取 AssetHost

func (h *Handler) GetNewScratchProject(c *gin.Context) {
	// 从嵌入的文件系统中获取index.html
	scratchFS, err := fs.Sub(web.ScratchStaticFiles, "scratch/dist")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "无法访问静态文件",
		})
		return
	}

	// 读取index.html文件
	htmlContent, err := fs.ReadFile(scratchFS, "index.html")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "无法读取index.html",
		})
		return
	}

	// 将HTML内容转换为字符串
	htmlStr := string(htmlContent)

	// 创建模板
	tmpl, err := template.New("scratch").Parse(htmlStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "解析模板失败",
		})
		return
	}

	// 准备模板数据，新项目不需要项目ID
	data := struct {
		ProjectID string
		Host      string
	}{
		ProjectID: "0",                         // 新项目使用0作为ID
		Host:      h.config.ScratchEditor.Host, // 从配置中获取 ScratchEditorHost
	}

	// 设置响应头
	c.Header("Content-Type", "text/html; charset=utf-8")

	// 执行模板并将结果写入响应
	if err := tmpl.Execute(c.Writer, data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "渲染模板失败",
		})
		return
	}
}

// GetOpenScratchProject 打开Scratch项目
// 修改 GetOpenScratchProject 函数中的 AssetHost
func (h *Handler) GetOpenScratchProject(c *gin.Context) {
	projectID := c.Param("id")

	// 从 service 获取项目数据
	// 将 projectID 字符串转换为 uint 类型
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}
	ok := h.services.ScratchService.CanReadProject(uint(id))
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取项目失败",
		})
		return
	}

	// 从嵌入的文件系统中获取index.html
	scratchFS, err := fs.Sub(web.ScratchStaticFiles, "scratch/dist")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "无法访问静态文件",
		})
		return
	}

	// 读取index.html文件
	htmlContent, err := fs.ReadFile(scratchFS, "index.html")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "无法读取index.html",
		})
		return
	}

	// 将HTML内容转换为字符串
	htmlStr := string(htmlContent)

	// 创建模板
	tmpl, err := template.New("scratch").Parse(htmlStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "解析模板失败",
		})
		return
	}

	// 准备模板数据，新项目不需要项目ID
	data := struct {
		ProjectID string
		Host      string
	}{
		ProjectID: "0",                         // 新项目使用0作为ID
		Host:      h.config.ScratchEditor.Host, // 从配置中获取 ScratchEditorHost
	}

	// 设置响应头
	c.Header("Content-Type", "text/html; charset=utf-8")

	// 执行模板并将结果写入响应
	if err := tmpl.Execute(c.Writer, data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "渲染模板失败",
		})
		return
	}
}

func (h *Handler) GetScratchProject(c *gin.Context) {
	projectID := c.Param("id")

	// 从 service 获取项目数据
	// 将 projectID 字符串转换为 uint 类型
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}
	projectData, err := h.services.ScratchService.GetProject(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取项目失败",
		})
		return
	}

	// 设置响应头为二进制数据
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Length", strconv.Itoa(len(projectData)))

	// 直接写入字节数据
	c.Writer.Write(projectData)
}

// PutSaveScratchProject 保存Scratch项目
func (h *Handler) PutSaveScratchProject(c *gin.Context) {
	log.Println("dbg SaveScratchProject")
	// 获取当前用户ID
	userID := h.getUserID(c)

	// 新增：从路径参数获取项目ID
	projectID := c.Param("id")
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}

	// 修改后的请求体结构
	req := make(map[string]interface{})
	if err = c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求参数",
		})
		return
	}

	r, err := json.Marshal(req)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求参数: " + err.Error(),
		})
		return
	}
	title := c.DefaultQuery("title", "Scratch Project")

	// 保存项目
	// 修改服务调用参数
	// 由于 SaveProject 返回 uint 类型，需要将 projectID 声明为 uint
	_, err = h.services.ScratchService.SaveProject(userID, uint(id), title, r)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "保存项目失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

// ListScratchProjects 列出用户的所有Scratch项目
func (h *Handler) ListScratchProjects(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)

	// 获取分页参数
	pageSizeStr := c.DefaultQuery("pageSize", "20")
	beginIDStr := c.DefaultQuery("beginID", "0")
	forwardStr := c.DefaultQuery("forward", "true")
	ascStr := c.DefaultQuery("asc", "true")

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}

	beginID, err := strconv.ParseUint(beginIDStr, 10, 64)
	if err != nil {
		beginID = 0
	}

	// 获取项目总数
	total, err := h.services.ScratchService.CountProjects(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取项目总数失败: " + err.Error(),
		})
		return
	}

	// 解析布尔参数
	asc := ascStr == "true"
	forward := forwardStr == "true"

	// 获取项目列表
	projects, hasMore, err := h.services.ScratchService.ListProjectsWithPagination(userID, uint(pageSize), uint(beginID), forward, asc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取项目列表失败: " + err.Error(),
		})
		return
	}

	// 返回结果
	c.JSON(http.StatusOK, gin.H{
		"data":    projects,
		"hasMore": hasMore,
		"total":   total,
	})
}

// DeleteScratchProject 删除Scratch项目
func (h *Handler) DeleteScratchProject(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)

	// 获取项目ID
	projectID := c.Param("id")
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}

	// 删除项目
	if err := h.services.ScratchService.DeleteProject(userID, uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除项目失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "项目已删除",
	})
}

// getUserID 从上下文中获取当前用户ID
func (h *Handler) getUserID(c *gin.Context) uint {
	// 从上下文中获取用户信息
	userID, exists := c.Get("userID")
	if !exists {
		return 0
	}
	return userID.(uint)
}

// PostCreateScratchProject 创建新的Scratch项目
func (h *Handler) PostCreateScratchProject(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)

	// 添加限流逻辑
	h.createProjectLimiterLock.Lock()
	now := time.Now()

	// 获取用户的调用记录
	times, exists := h.createProjectLimiter[userID]
	if !exists {
		times = []time.Time{}
	}

	// 清理3分钟前的记录
	var validTimes []time.Time
	for _, t := range times {
		if now.Sub(t) < 3*time.Minute {
			validTimes = append(validTimes, t)
		}
	}

	// 检查是否超过限制（3分钟内最多3次）
	if len(validTimes) >= 3 {
		h.createProjectLimiterLock.Unlock()
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "操作过于频繁，请稍后再试",
		})
		return
	}

	// 添加当前时间到记录中
	validTimes = append(validTimes, now)
	h.createProjectLimiter[userID] = validTimes
	h.createProjectLimiterLock.Unlock()

	title := c.DefaultQuery("title", "Scratch Project")

	// 解析请求参数
	req := make(map[string]interface{})

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求参数: " + err.Error(),
		})
		return
	}

	// 检查请求体是否为空
	if len(req) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求体不能为空",
		})
		return
	}

	r, err := json.Marshal(req)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求参数: " + err.Error(),
		})
		return
	}

	// 调用服务创建项目（使用0表示新项目）
	projectID, err := h.services.ScratchService.SaveProject(userID, 0, title, r)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "创建项目失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"content-name": projectID,
		"status":       "ok",
	})
}

// GetLibraryAsset 获取Scratch库资源文件
func (h *Handler) GetLibraryAsset(c *gin.Context) {
	// 获取文件名参数
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "未指定文件名",
		})
		return
	}

	// 从嵌入的文件系统中获取资源文件
	assetData, err := web.GetScratchAsset(filename)
	if err != nil {
		// 使用 scratch 服务的基础路径
		filePath := filepath.Join(h.services.ScratchService.GetScratchBasePath(), "assets", filename)

		// 尝试从文件系统中读取资源文件
		assetData, err = os.ReadFile(filePath)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "资源文件不存在",
			})
			return
		}
	}

	// 根据文件扩展名设置适当的Content-Type
	contentType := "application/octet-stream" // 默认
	switch {
	case strings.HasSuffix(filename, ".svg"):
		contentType = "image/svg+xml"
	case strings.HasSuffix(filename, ".png"):
		contentType = "image/png"
	case strings.HasSuffix(filename, ".jpg"), strings.HasSuffix(filename, ".jpeg"):
		contentType = "image/jpeg"
	case strings.HasSuffix(filename, ".wav"):
		contentType = "audio/wav"
	case strings.HasSuffix(filename, ".mp3"):
		contentType = "audio/mpeg"
	case strings.HasSuffix(filename, ".json"):
		contentType = "application/json"
	}

	// 设置响应头
	c.Header("Content-Type", contentType)
	c.Header("Content-Length", strconv.Itoa(len(assetData)))

	// 直接写入字节数据
	c.Writer.Write(assetData)
}

// UploadScratchAsset 处理上传的Scratch资源文件
func (h *Handler) UploadScratchAsset(c *gin.Context) {
	// 获取当前用户ID
	// userID := h.getUserID(c)
	// if userID == 0 {
	// 	c.JSON(http.StatusUnauthorized, gin.H{
	// 		"error": "未授权",
	// 	})
	// 	return
	// }

	// 获取资源ID
	assetID := c.Param("asset_id")
	if assetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的资源ID",
		})
		return
	}

	// 读取请求体中的二进制数据
	bodyData, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "读取请求数据失败: " + err.Error(),
		})
		return
	}

	if len(bodyData) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求体为空",
		})
		return
	}

	// 根据文件扩展名设置适当的Content-Type
	contentType := "application/octet-stream" // 默认
	switch {
	case strings.HasSuffix(assetID, ".svg"):
		contentType = "image/svg+xml"
	case strings.HasSuffix(assetID, ".png"):
		contentType = "image/png"
	case strings.HasSuffix(assetID, ".jpg"), strings.HasSuffix(assetID, ".jpeg"):
		contentType = "image/jpeg"
	case strings.HasSuffix(assetID, ".wav"):
		contentType = "audio/wav"
	case strings.HasSuffix(assetID, ".mp3"):
		contentType = "audio/mpeg"
	case strings.HasSuffix(assetID, ".json"):
		contentType = "application/json"
	}

	// 使用 scratch 服务的基础路径
	assetDir := filepath.Join(h.services.ScratchService.GetScratchBasePath(), "assets")
	if err := os.MkdirAll(assetDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "创建资源目录失败: " + err.Error(),
		})
		return
	}

	// 保存文件
	filePath := filepath.Join(assetDir, assetID)
	if err := os.WriteFile(filePath, bodyData, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "保存文件失败: " + err.Error(),
		})
		return
	}

	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"status":       "ok",
		"assetID":      assetID,
		"content_type": contentType,
	})
}
