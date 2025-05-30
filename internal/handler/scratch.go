package handler

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
	"github.com/jun/fun_code/internal/model"
	"github.com/jun/fun_code/web"
)

const (
	ErrorCodeInvalidProjectID     = 1
	ErrorCodeGetProjectFailed     = 2
	ErrorCodeNoPermission         = 3
	ErrorCodeInvalidAssetID       = 4
	ErrorCodeSaveProjectFailed    = 5
	ErrorCodeReadBodyFailed       = 6
	ErrorCodeCreateAssetDirFailed = 7
	ErrorCodeSaveAssetFailed      = 8
	ErrorCodeGetAssetFailed       = 9
	ErrorCodeUnauthorized         = 10
	ErrorCodeGetThumbnailFailed   = 11
	ErrorCodeInvalidUserID        = 12
	ErrorCodeSearchFailed         = 13
	ErrorCodeInvalidKeyword       = 14
)

// NewScratchProject 创建一个新的Scratch项目处理程序

func (h *Handler) GetNewScratchProject(c *gin.Context) {

	// 创建项目记录
	projectID, err := h.dao.ScratchDao.CreateProject(h.getUserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "无法创建项目记录",
		})
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("/projects/scratch/open/%d", projectID))

}

// GetOpenScratchProject 打开Scratch项目
// 修改 GetOpenScratchProject 函数中的 AssetHost
func (h *Handler) GetOpenScratchProject(c *gin.Context) {
	rawID := c.Param("id")
	splitID := strings.Split(rawID, "_")

	if len(splitID) == 0 {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeInvalidProjectID, "invalid_project_id", nil)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	projectID := splitID[0]

	// 从 service 获取项目数据
	// 将 projectID 字符串转换为 uint 类型
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}
	// 获取项目创建者ID
	project, err := h.dao.ScratchDao.GetProject(uint(id))
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}
	userID := project.UserID
	loginedUserID := h.getUserID(c)
	// 判断用户是否是项目创建者或者为管理员
	if userID != loginedUserID && !h.hasPermission(c, PermissionManageAll) {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeNoPermission, "no_permission", err)
		c.JSON(http.StatusUnauthorized, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	user, err := h.dao.UserDao.GetUserByID(loginedUserID)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 从嵌入的文件系统中获取index.html
	scratchFS, err := fs.Sub(web.ScratchStaticFiles, "scratch/dist")
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 读取index.html文件
	htmlContent, err := fs.ReadFile(scratchFS, "index.html")
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 将HTML内容转换为字符串
	htmlStr := string(htmlContent)

	// 创建模板
	tmpl, err := template.New("scratch").Parse(htmlStr)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 如果项目ID存在保护的数组中，则不允许保存
	canSaveProject := true
	for _, id := range h.config.Protected.Projects {
		if project.ID == id {
			canSaveProject = false
			break
		}
	}

	// 准备模板数据，新项目不需要项目ID
	data := struct {
		CanSaveProject bool
		ProjectID      string
		Host           string
		ProjectTitle   string
		CanRemix       bool
		UserName       string
		NickName       string
	}{
		CanSaveProject: canSaveProject,
		ProjectID:      rawID,                       // 新项目使用0作为ID
		Host:           h.config.ScratchEditor.Host, // 从配置中获取 ScratchEditorHost
		ProjectTitle:   project.Name,
		CanRemix:       project.UserID == loginedUserID,
		UserName:       user.Username,
		NickName:       user.Nickname,
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
	rawID := c.Param("id")
	splitID := strings.Split(rawID, "_")

	if len(splitID) == 0 {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeInvalidProjectID, "invalid_project_id", nil)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
	}

	projectID := splitID[0]

	historyID := ""
	if len(splitID) == 2 {
		historyID = splitID[1]
	}
	// 从 service 获取项目数据
	// 将 projectID 字符串转换为 uint 类型
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeInvalidProjectID, "invalid_project_id", err)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 获取项目创建者ID
	userID, ok := h.dao.ScratchDao.GetProjectUserID(uint(id))
	if !ok {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}
	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusUnauthorized, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	projectData, err := h.dao.ScratchDao.GetProjectBinary(uint(id), historyID)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
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

	rawID := c.Param("id")
	splitID := strings.Split(rawID, "_")

	if len(splitID) == 0 {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeInvalidProjectID, "invalid_project_id", nil)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	projectID := splitID[0]

	// 从路径参数获取项目ID
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}

	// 获取项目创建者ID
	project, err := h.dao.ScratchDao.GetProject(uint(id))

	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}
	userID := project.UserID
	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeNoPermission, "no_permission", err)
		c.JSON(http.StatusUnauthorized, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 如果项目ID存在在不允许保存的数组中，则不允许保存
	for _, id := range h.config.Protected.Projects {
		if project.ID == id {
			e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeNoPermission, "no_permission", err)
			c.JSON(http.StatusUnauthorized, ResponseError{
				Code:    int(e.ErrorCode()),
				Message: e.Message,
				Error:   e.Error(),
			})
			return
		}
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
	_, err = h.dao.ScratchDao.SaveProject(userID, uint(id), title, r)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeSaveProjectFailed, "save_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       "ok",
		"content-name": id,
	})
}

// DeleteScratchProject 删除Scratch项目
func (h *Handler) DeleteScratchProject(c *gin.Context) {

	// 获取项目ID
	projectID := c.Param("id")
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}

	// 如果项目ID存在在不允许保存的数组中，则不允许保存
	for _, protectedID := range h.config.Protected.Projects {
		if uint(id) == protectedID {
			e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeNoPermission, "no_permission", err)
			c.JSON(http.StatusBadRequest, ResponseError{
				Code:    int(e.ErrorCode()),
				Message: e.Message,
				Error:   e.Error(),
			})
			return
		}
	}
	// 获取项目创建者ID
	userID, ok := h.dao.ScratchDao.GetProjectUserID(uint(id))
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取项目失败",
		})
		return
	}
	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "无权限访问",
		})
		return
	}

	// 删除项目
	if err := h.dao.ScratchDao.DeleteProject(userID, uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除项目失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "项目已删除",
	})
}

// PostCreateScratchProject 创建新的Scratch项目
func (h *Handler) PostCreateScratchProject(c *gin.Context) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}

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
	if len(validTimes) >= h.config.ScratchEditor.CreateProjectLimiter {
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
	projectID, err := h.dao.ScratchDao.SaveProject(userID, 0, title, r)
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

var safeFilenameRegex = regexp.MustCompile(`[^a-zA-Z0-9_.-]`)

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

	// 去除不安全的字符，使用正则表达式
	filename = safeFilenameRegex.ReplaceAllString(filename, "")

	// 从嵌入的文件系统中获取资源文件
	assetData, err := web.GetScratchAsset(filename)
	if err != nil {

		// 获取 assetID 字符串长度，把它分成 4 段
		assetIDLength := len(filename)
		if assetIDLength < 36 {
			e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeInvalidAssetID, "invalid_asset_id", nil)
			c.JSON(http.StatusBadRequest, ResponseError{
				Code:    int(e.ErrorCode()),
				Message: e.Message,
				Error:   e.Error(),
			})
			return
		}

		assetID1 := filename[:assetIDLength/4]
		assetID2 := filename[assetIDLength/4 : assetIDLength/2]
		assetID3 := filename[assetIDLength/2 : assetIDLength*3/4]
		assetID4 := filename[assetIDLength*3/4:]

		// 使用 scratch 服务的基础路径
		filePath := filepath.Join(h.dao.ScratchDao.GetScratchBasePath(), "assets", assetID1, assetID2, assetID3, assetID4)

		// 尝试从文件系统中读取资源文件
		assetData, err = os.ReadFile(filePath)
		if err != nil {
			e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetAssetFailed, "get_asset_failed", err)
			c.JSON(http.StatusNotFound, ResponseError{
				Code:    int(e.ErrorCode()),
				Message: e.Message,
				Error:   e.Error(),
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
	userID := h.getUserID(c)
	if userID == 0 {
		e := custom_error.NewHandlerError(custom_error.USER, ErrorCodeUnauthorized, "unauthorized", nil)
		c.JSON(http.StatusUnauthorized, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 获取资源ID
	assetID := c.Param("asset_id")
	if assetID == "" {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeInvalidAssetID, "invalid_asset_id", nil)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 去除不安全的字符，使用正则表达式
	assetID = safeFilenameRegex.ReplaceAllString(assetID, "")

	// 获取 assetID 字符串长度，把它分成 4 段
	assetIDLength := len(assetID)
	if assetIDLength < 36 {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeInvalidAssetID, "invalid_asset_id", nil)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	//  最多只读取2MB
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2*1024*1024)

	// 读取请求体中的二进制数据
	bodyData, err := io.ReadAll(c.Request.Body)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeReadBodyFailed, "read_body_failed", err)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	if len(bodyData) == 0 {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeReadBodyFailed, "read_body_failed", nil)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
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

	assetID1 := assetID[:assetIDLength/4]
	assetID2 := assetID[assetIDLength/4 : assetIDLength/2]
	assetID3 := assetID[assetIDLength/2 : assetIDLength*3/4]
	assetID4 := assetID[assetIDLength*3/4:]

	// 使用 scratch 服务的基础路径
	assetDir := filepath.Join(h.dao.ScratchDao.GetScratchBasePath(), "assets", assetID1, assetID2, assetID3)
	if err := os.MkdirAll(assetDir, 0755); err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeCreateAssetDirFailed, "create_asset_dir_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 保存文件
	filePath := filepath.Join(assetDir, assetID4)
	if err := os.WriteFile(filePath, bodyData, 0644); err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeSaveAssetFailed, "save_asset_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 保存用户资源
	err = h.dao.UserAssetDao.CreateUserAsset(&model.UserAsset{
		UserID:    userID,
		AssetID:   assetID,
		AssetType: contentType,
		Size:      int64(len(bodyData)),
	})
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.USER_ASSET, ErrorCodeSaveAssetFailed, "save_asset_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
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

// PutUpdateProjectThumbnail 更新Scratch项目缩略图
func (h *Handler) PutUpdateProjectThumbnail(c *gin.Context) {

	// 从路径参数获取项目ID
	rawID := c.Param("id")
	splitID := strings.Split(rawID, "_")

	if len(splitID) == 0 {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeInvalidProjectID, "invalid_project_id", nil)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	projectID := splitID[0]
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}

	// 获取项目创建者ID
	project, err := h.dao.ScratchDao.GetProject(uint(id))

	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}
	userID := project.UserID
	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeNoPermission, "no_permission", err)
		c.JSON(http.StatusUnauthorized, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 如果项目ID存在在不允许保存的数组中，则不允许保存
	for _, id := range h.config.Protected.Projects {
		if project.ID == id {
			e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeNoPermission, "no_permission", err)
			c.JSON(http.StatusUnauthorized, ResponseError{
				Code:    int(e.ErrorCode()),
				Message: e.Message,
				Error:   e.Error(),
			})
			return
		}
	}

	//读取 body，最多只读取 2M
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2*1024*1024)

	// 读取请求体中的二进制数据
	bodyData, err := io.ReadAll(c.Request.Body)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeReadBodyFailed, "read_body_failed", err)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	if len(bodyData) == 0 {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeReadBodyFailed, "read_body_failed", nil)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	dirPath := filepath.Join(h.dao.ScratchDao.GetScratchBasePath(), project.FilePath)
	// 构建新的文件路径
	filename := filepath.Join(dirPath, fmt.Sprintf("%d.png", project.ID))

	// 保存文件
	if err := os.WriteFile(filename, bodyData, 0644); err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeSaveAssetFailed, "save_asset_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

// GetProjectThumbnail 获取Scratch项目缩略图
func (h *Handler) GetProjectThumbnail(c *gin.Context) {
	// 从路径参数获取项目ID
	projectID := c.Param("id")
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}

	// 获取项目创建者ID
	project, err := h.dao.ScratchDao.GetProject(uint(id))

	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}
	userID := project.UserID
	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeNoPermission, "no_permission", err)
		c.JSON(http.StatusUnauthorized, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 使用 scratch 服务的基础路径
	dirPath := filepath.Join(h.dao.ScratchDao.GetScratchBasePath(), project.FilePath)
	// 构建新的文件路径
	filename := filepath.Join(dirPath, fmt.Sprintf("%d.png", project.ID))

	// 如果文件不存在，则返回404
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetThumbnailFailed, "get_thumbnail_failed", err)
		c.JSON(http.StatusNotFound, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 读取文件
	bodyData, err := os.ReadFile(filename)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetThumbnailFailed, "get_thumbnail_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 设置响应头
	c.Header("Content-Type", "image/png")
	c.Header("Content-Length", strconv.Itoa(len(bodyData)))

	// 直接写入字节数据
	c.Writer.Write(bodyData)
}

// GetScratchProjectHistories 获取Scratch项目历史记录
func (h *Handler) GetScratchProjectHistories(c *gin.Context) {
	// 从路径参数获取项目ID
	projectID := c.Param("id")
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的项目ID",
		})
		return
	}

	// 获取项目创建者ID
	project, err := h.dao.ScratchDao.GetProject(uint(id))

	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}
	userID := project.UserID
	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeNoPermission, "no_permission", err)
		c.JSON(http.StatusUnauthorized, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 通过 project id 生成文件名通配符，遍历文件名，获取项目历史文件列表
	dirPath := filepath.Join(h.dao.ScratchDao.GetScratchBasePath(), project.FilePath)
	filename := filepath.Join(dirPath, fmt.Sprintf("%d_*.json", project.ID))
	files, err := filepath.Glob(filename)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeGetProjectFailed, "get_project_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	// 遍历文件名，获取文件创建时间，
	histories := make([]model.History, len(files))

	for i, file := range files {
		info, err := os.Stat(file)
		if err != nil {
			continue
		}
		filename := filepath.Base(file)
		filename = strings.TrimSuffix(filename, ".json")
		histories[i] = model.History{
			Filename:  filename,
			CreatedAt: info.ModTime(),
		}
	}

	// 按照创建时间逆序排序
	sort.Slice(histories, func(i, j int) bool {
		return histories[i].CreatedAt.After(histories[j].CreatedAt)
	})

	data := struct {
		ProjectID uint            `json:"project_id"`
		Name      string          `json:"name"`
		CreatedAt time.Time       `json:"created_at"`
		UpdatedAt time.Time       `json:"updated_at"`
		Histories []model.History `json:"histories"`
	}{
		ProjectID: project.ID,
		Name:      project.Name,
		CreatedAt: project.CreatedAt,
		UpdatedAt: project.UpdatedAt,
		Histories: histories,
	}

	// 返回项目历史记录列表，包含文件创建时间
	c.JSON(http.StatusOK, gin.H{
		"data": data,
	})
}
