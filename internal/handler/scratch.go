package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/jun/fun_code/web"
	"github.com/mail2fish/gorails/gorails"
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

// GetScratchProjectParams 获取Scratch项目请求参数
type GetScratchProjectParams struct {
	ID string `json:"id" uri:"id" binding:"required"`
}

func (p *GetScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetScratchProjectHandler 获取Scratch项目 gorails.Wrap 形式
func (h *Handler) GetScratchProjectHandler(c *gin.Context, params *GetScratchProjectParams) ([]byte, *gorails.ResponseMeta, gorails.Error) {
	rawID := params.ID
	splitID := strings.Split(rawID, "_")

	if len(splitID) == 0 {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	projectID := splitID[0]
	historyID := ""
	if len(splitID) == 2 {
		historyID = splitID[1]
	}

	// 将 projectID 字符串转换为 uint 类型
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 获取项目创建者ID
	userID, ok := h.dao.ScratchDao.GetProjectUserID(uint(id))
	if !ok {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, nil)
	}

	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	}

	projectData, err := h.dao.ScratchDao.GetProjectBinary(uint(id), historyID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 设置响应头为二进制数据
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Length", strconv.Itoa(len(projectData)))

	return projectData, nil, nil
}

// GetLibraryAssetParams 获取Scratch库资源文件请求参数
type GetLibraryAssetParams struct {
	Filename string `json:"filename" uri:"filename" binding:"required"`
}

func (p *GetLibraryAssetParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetLibraryAssetHandler 获取Scratch库资源文件 gorails.Wrap 形式
func (h *Handler) GetLibraryAssetHandler(c *gin.Context, params *GetLibraryAssetParams) ([]byte, *gorails.ResponseMeta, gorails.Error) {
	filename := params.Filename
	if filename == "" {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	// 去除不安全的字符，使用正则表达式
	safeFilenameRegex := regexp.MustCompile(`[^a-zA-Z0-9_.-]`)
	filename = safeFilenameRegex.ReplaceAllString(filename, "")

	// 从嵌入的文件系统中获取资源文件
	assetData, err := web.GetScratchAsset(filename)
	if err != nil {
		// 获取 assetID 字符串长度，把它分成 4 段
		assetIDLength := len(filename)
		if assetIDLength < 36 {
			return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
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
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
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

	return assetData, nil, nil
}

// UploadScratchAssetParams 上传Scratch资源文件请求参数
type UploadScratchAssetParams struct {
	AssetID string `json:"asset_id" uri:"asset_id" binding:"required"`
}

func (p *UploadScratchAssetParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// UploadScratchAssetResponse 上传Scratch资源文件响应
type UploadScratchAssetResponse struct {
	Status  string `json:"status"`
	AssetID string `json:"asset_id"`
}

// UploadScratchAssetHandler 上传Scratch资源文件 gorails.Wrap 形式
func (h *Handler) UploadScratchAssetHandler(c *gin.Context, params *UploadScratchAssetParams) (*UploadScratchAssetResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_USER, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	assetID := params.AssetID
	if assetID == "" {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	// 去除不安全的字符，使用正则表达式
	safeFilenameRegex := regexp.MustCompile(`[^a-zA-Z0-9_.-]`)
	assetID = safeFilenameRegex.ReplaceAllString(assetID, "")

	// 获取 assetID 字符串长度，把它分成 4 段
	assetIDLength := len(assetID)
	if assetIDLength < 36 {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	//  最多只读取2MB
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2*1024*1024)

	// 读取请求体中的二进制数据
	bodyData, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeReadBodyFailed, global.ErrorMsgReadBodyFailed, err)
	}

	if len(bodyData) == 0 {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
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
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_USER_ASSET, global.ErrorCodeCreateFailed, global.ErrorMsgCreateFailed, err)
	}

	// 保存文件
	filePath := filepath.Join(assetDir, assetID4)
	if err := os.WriteFile(filePath, bodyData, 0644); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_USER_ASSET, global.ErrorCodeWriteFileFailed, global.ErrorMsgWriteFileFailed, err)
	}

	// 保存用户资源
	err = h.dao.UserAssetDao.CreateUserAsset(&model.UserAsset{
		UserID:    userID,
		AssetID:   assetID,
		AssetType: contentType,
		Size:      int64(len(bodyData)),
	})
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_USER_ASSET, global.ErrorCodeCreateFailed, global.ErrorMsgCreateFailed, err)
	}

	return &UploadScratchAssetResponse{
		Status:  "ok",
		AssetID: assetID,
	}, nil, nil
}

func RenderUploadScratchAssetResponse(c *gin.Context, response *UploadScratchAssetResponse, meta *gorails.ResponseMeta) {
	c.JSON(http.StatusOK, response)
}

// GetScratchProjectHistoriesParams 获取Scratch项目历史记录请求参数
type GetScratchProjectHistoriesParams struct {
	ID string `json:"id" uri:"id" binding:"required"`
}

func (p *GetScratchProjectHistoriesParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetScratchProjectHistoriesResponse 获取Scratch项目历史记录响应
type GetScratchProjectHistoriesResponse struct {
	ProjectID uint            `json:"project_id"`
	Name      string          `json:"name"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Histories []model.History `json:"histories"`
}

// GetScratchProjectHistoriesHandler 获取Scratch项目历史记录 gorails.Wrap 形式
func (h *Handler) GetScratchProjectHistoriesHandler(c *gin.Context, params *GetScratchProjectHistoriesParams) (*GetScratchProjectHistoriesResponse, *gorails.ResponseMeta, gorails.Error) {
	// 从路径参数获取项目ID
	projectID := params.ID
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 获取项目创建者ID
	project, err := h.dao.ScratchDao.GetProject(uint(id))
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	userID := project.UserID
	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	}

	// 通过 project id 生成文件名通配符，遍历文件名，获取项目历史文件列表
	dirPath := filepath.Join(h.dao.ScratchDao.GetScratchBasePath(), project.FilePath)
	filename := filepath.Join(dirPath, fmt.Sprintf("%d_*.json", project.ID))
	files, err := filepath.Glob(filename)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 遍历文件名，获取文件创建时间
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

	response := &GetScratchProjectHistoriesResponse{}
	response.ProjectID = project.ID
	response.Name = project.Name
	response.CreatedAt = project.CreatedAt
	response.UpdatedAt = project.UpdatedAt
	response.Histories = histories

	return response, nil, nil
}

// DeleteScratchProjectParams 删除Scratch项目参数
// 只需要项目ID
type DeleteScratchProjectParams struct {
	ProjectID uint `json:"project_id" uri:"id" binding:"required"`
}

func (p *DeleteScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// DeleteScratchProjectHandler gorails.Wrap 形式
func (h *Handler) DeleteScratchProjectHandler(c *gin.Context, params *DeleteScratchProjectParams) (*gorails.ResponseEmpty, *gorails.ResponseMeta, gorails.Error) {
	id := params.ProjectID
	// 如果项目ID存在在不允许保存的数组中，则不允许删除
	for _, protectedID := range h.config.Protected.Projects {
		if id == protectedID {
			return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
		}
	}
	// 获取项目创建者ID
	userID, ok := h.dao.ScratchDao.GetProjectUserID(id)
	if !ok {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, nil)
	}
	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	}
	// 删除项目
	if err := h.dao.ScratchDao.DeleteProject(userID, id); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeDeleteFailed, global.ErrorMsgDeleteFailed, err)
	}
	// 删除分享
	h.dao.ShareDao.DeleteShare(id, userID)
	return &gorails.ResponseEmpty{}, nil, nil
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

// RenderScratchProject 渲染Scratch项目数据
func RenderScratchProject(c *gin.Context, data []byte, meta *gorails.ResponseMeta) {
	// 设置响应头为JSON格式
	c.Header("Content-Type", "application/json")
	c.Header("Content-Length", strconv.Itoa(len(data)))
	c.Data(http.StatusOK, "application/json", data)
}

// RenderLibraryAsset 渲染Scratch库资源文件
func RenderLibraryAsset(c *gin.Context, data []byte, meta *gorails.ResponseMeta) {
	// 根据文件扩展名确定Content-Type
	filename := c.Param("filename")
	contentType := "application/octet-stream" // 默认类型

	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".svg":
		contentType = "image/svg+xml"
	case ".png":
		contentType = "image/png"
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".gif":
		contentType = "image/gif"
	case ".wav":
		contentType = "audio/wav"
	case ".mp3":
		contentType = "audio/mpeg"
	case ".ogg":
		contentType = "audio/ogg"
	case ".json":
		contentType = "application/json"
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Length", strconv.Itoa(len(data)))
	c.Data(http.StatusOK, contentType, data)
}

// GetOpenScratchProjectParams 打开Scratch项目参数
type GetStudentScratchProjectParams struct {
	RawID     string `uri:"id"`
	ClassID   int64
	CourseID  int64
	LessonID  int64
	ProjectID int64
}

func (p *GetStudentScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	rawID := c.Param("id")
	splitID := strings.Split(rawID, "_")
	if len(splitID) != 4 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}
	var err error
	p.ClassID, err = strconv.ParseInt(splitID[0], 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	p.CourseID, err = strconv.ParseInt(splitID[1], 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	p.LessonID, err = strconv.ParseInt(splitID[2], 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	p.ProjectID, err = strconv.ParseInt(splitID[3], 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetStudentScratchProjectHandler 获取Scratch项目 gorails.Wrap 形式
func (h *Handler) GetStudentScratchProjectHandler(c *gin.Context, params *GetStudentScratchProjectParams) ([]byte, *gorails.ResponseMeta, gorails.Error) {

	loginedUserID := h.getUserID(c)

	// 获取课时信息
	lesson, err := h.dao.LessonDao.GetLesson(uint(params.LessonID))
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
	}

	// 验证课程ID是否在课时的关联课程中
	isLessonInCourse, err := h.dao.LessonDao.IsLessonInCourse(uint(params.LessonID), uint(params.CourseID))
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}
	if !isLessonInCourse {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, errors.New("课时不属于指定课程"))
	}

	// 检查 project_id 是否是 lesson_id 的 project_id_1
	if lesson.ProjectID1 != uint(params.ProjectID) {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, errors.New("项目ID与课时关联的项目不匹配"))
	}

	// 检查课程是否在指定班级中
	isLessonInClass, err := h.dao.ClassDao.IsLessonInClass(uint(params.ClassID), uint(params.CourseID), uint(params.LessonID))
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	if !isLessonInClass {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, errors.New("课时所属的课程不在指定班级中"))
	}

	// 获取项目信息
	project, err := h.dao.ScratchDao.GetProject(uint(params.ProjectID))
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 检查权限：管理员、班级成员、课程作者或项目创建者都可以访问
	hasPermission := false

	// 1. 检查是否是管理员
	if h.hasPermission(c, PermissionManageAll) {
		hasPermission = true
	}

	// 2. 检查是否是项目创建者
	if !hasPermission && project.UserID == loginedUserID {
		hasPermission = true
	}

	// 3. 检查是否是课程作者
	if !hasPermission {
		course, err := h.dao.CourseDao.GetCourse(uint(params.CourseID))
		if err == nil && course.AuthorID == loginedUserID {
			hasPermission = true
		}
	}

	// 4. 检查是否是班级成员（学生或教师）
	if !hasPermission && h.isClassMember(c, uint(params.ClassID)) {
		hasPermission = true
	}

	if !hasPermission {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, errors.New("您没有权限访问该项目"))
	}

	projectData, err := h.dao.ScratchDao.GetProjectBinary(uint(params.ProjectID), "")
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 设置响应头为二进制数据
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Length", strconv.Itoa(len(projectData)))

	return projectData, nil, nil
}
