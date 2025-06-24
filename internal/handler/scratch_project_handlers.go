package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
)

// CreateScratchProjectParams 创建Scratch项目参数
type CreateScratchProjectParams struct {
	Title string                 `json:"title" form:"title"`
	Data  map[string]interface{} `json:"data" binding:"required"`
}

func (p *CreateScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	if p.Title == "" {
		p.Title = "Scratch Project"
	}
	return nil
}

// CreateScratchProjectResponse 创建Scratch项目响应
type CreateScratchProjectResponse struct {
	ContentName uint   `json:"content-name"`
	Status      string `json:"status"`
}

func (h *Handler) CreateScratchProjectHandler(c *gin.Context, params *CreateScratchProjectParams) (*CreateScratchProjectResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
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
		return nil, nil, gorails.NewError(http.StatusTooManyRequests, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeTooManyRequests, global.ErrorMsgTooManyRequests, nil)
	}

	// 添加当前时间到记录中
	validTimes = append(validTimes, now)
	h.createProjectLimiter[userID] = validTimes
	h.createProjectLimiterLock.Unlock()

	// 序列化数据
	jsonData, err := json.Marshal(params.Data)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 调用服务创建项目（使用0表示新项目）
	projectID, err := h.dao.ScratchDao.SaveProject(userID, 0, params.Title, jsonData)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, global.ErrorMsgCreateFailed, err)
	}

	return &CreateScratchProjectResponse{
		ContentName: projectID,
		Status:      "ok",
	}, nil, nil
}

// SaveScratchProjectParams 保存Scratch项目参数
type SaveScratchProjectParams struct {
	ID    uint
	Data  map[string]interface{} `json:"data" binding:"required"`
	Title string
}

func (p *SaveScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	rawID := c.Param("id")
	splitID := strings.Split(rawID, "_")

	if len(splitID) == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	projectID := splitID[0]

	// 从路径参数获取项目ID
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	p.ID = uint(id)

	// 修改后的请求体结构
	req := make(map[string]interface{})
	if err = c.ShouldBindJSON(&req); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	p.Data = req
	p.Title = c.DefaultQuery("title", "Scratch Project")
	return nil
}

// SaveScratchProjectResponse 保存Scratch项目响应
type SaveScratchProjectResponse struct {
	Status      string `json:"status"`
	ContentName uint   `json:"content-name"`
}

func (h *Handler) SaveScratchProjectHandler(c *gin.Context, params *SaveScratchProjectParams) (*SaveScratchProjectResponse, *gorails.ResponseMeta, gorails.Error) {

	// 获取项目创建者ID
	project, err := h.dao.ScratchDao.GetProject(params.ID)

	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}
	userID := project.UserID
	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	}

	// 如果项目ID存在在不允许保存的数组中，则不允许保存
	for _, id := range h.config.Protected.Projects {
		if project.ID == id {
			return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
		}
	}

	r, err := json.Marshal(params.Data)

	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 保存项目
	// 修改服务调用参数
	// 由于 SaveProject 返回 uint 类型，需要将 projectID 声明为 uint
	_, err = h.dao.ScratchDao.SaveProject(userID, params.ID, params.Title, r)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, global.ErrorMsgCreateFailed, err)
	}

	return &SaveScratchProjectResponse{
		Status:      "ok",
		ContentName: params.ID,
	}, nil, nil
}

func RenderSaveScratchProjectResponse(c *gin.Context, response *SaveScratchProjectResponse, meta *gorails.ResponseMeta) {
	c.JSON(http.StatusOK, response)
}

// UpdateProjectThumbnailParams 更新项目缩略图参数
type UpdateProjectThumbnailParams struct {
	ID   uint
	Body io.ReadCloser
}

func (p *UpdateProjectThumbnailParams) Parse(c *gin.Context) gorails.Error {
	// 从路径参数获取项目ID
	rawID := c.Param("id")
	splitID := strings.Split(rawID, "_")

	if len(splitID) == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	projectID := splitID[0]
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	p.ID = uint(id)

	// 读取 body，最多只读取 2M
	p.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2*1024*1024)
	return nil
}

// UpdateProjectThumbnailResponse 更新项目缩略图响应
type UpdateProjectThumbnailResponse struct {
	Status string `json:"status"`
}

func (h *Handler) UpdateProjectThumbnailHandler(c *gin.Context, params *UpdateProjectThumbnailParams) (*UpdateProjectThumbnailResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 获取项目创建者ID
	project, err := h.dao.ScratchDao.GetProject(params.ID)

	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}
	// 判断用户是否是项目创建者或者为管理员
	if project.UserID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	}

	// 如果项目ID存在在不允许保存的数组中，则不允许保存
	for _, id := range h.config.Protected.Projects {
		if project.ID == id {
			return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
		}
	}

	// 读取请求体中的二进制数据
	bodyData, err := io.ReadAll(params.Body)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeReadBodyFailed, global.ErrorMsgReadBodyFailed, err)
	}

	if len(bodyData) == 0 {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeReadBodyFailed, global.ErrorMsgReadBodyFailed, nil)
	}

	dirPath := filepath.Join(h.dao.ScratchDao.GetScratchBasePath(), project.FilePath)
	// 构建新的文件路径
	filename := filepath.Join(dirPath, fmt.Sprintf("%d.png", project.ID))

	// 保存文件
	if err := os.WriteFile(filename, bodyData, 0644); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeWriteFileFailed, global.ErrorMsgWriteFileFailed, err)
	}
	return &UpdateProjectThumbnailResponse{
		Status: "ok",
	}, nil, nil
}

// GetProjectThumbnailParams 获取项目缩略图参数
type GetProjectThumbnailParams struct {
	ID uint `json:"id" uri:"id" binding:"required"`
}

func (p *GetProjectThumbnailParams) Parse(c *gin.Context) gorails.Error {
	projectID := c.Param("id")
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	p.ID = uint(id)
	return nil
}

func (h *Handler) GetProjectThumbnailHandler(c *gin.Context, params *GetProjectThumbnailParams) ([]byte, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 获取项目信息检查权限
	project, err := h.dao.ScratchDao.GetProject(params.ID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 检查权限
	if project.UserID != userID && !h.hasPermission(c, PermissionManageAll) && !h.dao.ShareDao.IsShareProject(params.ID) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	}

	// 使用 scratch 服务的基础路径
	dirPath := filepath.Join(h.dao.ScratchDao.GetScratchBasePath(), project.FilePath)
	// 构建缩略图文件路径
	filename := filepath.Join(dirPath, fmt.Sprintf("%d.png", project.ID))

	// 检查文件是否存在
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
	}

	// 读取文件内容
	bodyData, err := os.ReadFile(filename)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeReadFileFailed, global.ErrorMsgReadFileFailed, err)
	}

	// 设置响应头
	c.Header("Content-Type", "image/png")
	c.Header("Content-Length", strconv.Itoa(len(bodyData)))

	return bodyData, nil, nil
}

// ListScratchProjectsParams 列出Scratch项目参数
type ListScratchProjectsParams struct {
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
}

func (p *ListScratchProjectsParams) Parse(c *gin.Context) gorails.Error {
	// 设置默认值
	p.PageSize = 20
	p.BeginID = 0
	p.Forward = true
	p.Asc = true

	// 解析页面大小
	if pageSizeStr := c.DefaultQuery("pageSize", "20"); pageSizeStr != "" {
		if pageSize, err := strconv.ParseUint(pageSizeStr, 10, 32); err == nil {
			if pageSize > 0 && pageSize <= 100 {
				p.PageSize = uint(pageSize)
			}
		}
	}

	// 解析起始ID
	if beginIDStr := c.DefaultQuery("beginID", "0"); beginIDStr != "" {
		if beginID, err := strconv.ParseUint(beginIDStr, 10, 32); err == nil {
			p.BeginID = uint(beginID)
		}
	}

	// 解析翻页方向
	if forwardStr := c.DefaultQuery("forward", "true"); forwardStr != "" {
		p.Forward = forwardStr != "false"
	}

	// 解析排序方向
	if ascStr := c.DefaultQuery("asc", "true"); ascStr != "" {
		p.Asc = ascStr != "false"
	}
	return nil
}

type ProjectInfo struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	UserID    uint      `json:"user_id"`
}

func (h *Handler) ListScratchProjectsHandler(c *gin.Context, params *ListScratchProjectsParams) ([]model.ScratchProject, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 使用实际存在的方法获取项目列表
	// 获取所有项目列表
	projects, hasMore, err := h.dao.ScratchDao.ListProjectsWithPagination(userID, params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 获取总数
	total, err := h.dao.ScratchDao.CountProjects(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return projects, &gorails.ResponseMeta{
		Total:   int(total),
		HasNext: hasMore,
	}, nil
}

// SearchScratchParams 搜索Scratch项目参数
type SearchScratchParams struct {
	Keyword string
	UserID  uint
}

func (p *SearchScratchParams) Parse(c *gin.Context) gorails.Error {
	keyword := c.Query("keyword")
	userID := c.Query("userId")
	userIDInt, err := strconv.Atoi(userID)
	if err != nil {
		userIDInt = 0
	}
	p.Keyword = keyword

	if len(keyword) == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	p.UserID = uint(userIDInt)
	return nil
}

func (h *Handler) SearchScratchHandler(c *gin.Context, params *SearchScratchParams) ([]model.ScratchProject, *gorails.ResponseMeta, gorails.Error) {

	if !h.hasPermission(c, PermissionManageAll) {
		params.UserID = h.getUserID(c)
	}

	// 使用实际存在的搜索方法
	projects, err := h.dao.ScratchDao.SearchProjects(params.UserID, params.Keyword)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return projects, nil, nil
}

// RenderProjectThumbnail 渲染项目缩略图
func RenderProjectThumbnail(c *gin.Context, data []byte, meta *gorails.ResponseMeta) {
	// 简化实现，不使用Headers字段
	c.Writer.Write(data)
}

// GetAllScratchProjectParams 获取所有Scratch项目请求参数
type GetAllScratchProjectParams struct {
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
	UserID   uint `json:"user_id" form:"userID"`
}

func (p *GetAllScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	// 设置默认值
	p.PageSize = 20
	p.BeginID = 0
	p.Forward = true
	p.Asc = true
	p.UserID = 0

	// 解析页面大小
	if pageSizeStr := c.DefaultQuery("pageSize", "20"); pageSizeStr != "" {
		if pageSize, err := strconv.ParseUint(pageSizeStr, 10, 32); err == nil {
			if pageSize > 0 && pageSize <= 100 {
				p.PageSize = uint(pageSize)
			}
		}
	}

	// 解析起始ID
	if beginIDStr := c.DefaultQuery("beginID", "0"); beginIDStr != "" {
		if beginID, err := strconv.ParseUint(beginIDStr, 10, 32); err == nil {
			p.BeginID = uint(beginID)
		}
	}

	// 解析翻页方向
	if forwardStr := c.DefaultQuery("forward", "true"); forwardStr != "" {
		p.Forward = forwardStr != "false"
	}

	// 解析排序方向
	if ascStr := c.DefaultQuery("asc", "true"); ascStr != "" {
		p.Asc = ascStr != "false"
	}

	// 解析用户ID
	if userIDStr := c.DefaultQuery("userId", "0"); userIDStr != "" {
		if userID, err := strconv.ParseUint(userIDStr, 10, 32); err == nil {
			p.UserID = uint(userID)
		}
	}

	return nil
}

type GetAllScratchProjectResponse struct {
	Projects []model.ScratchProject `json:"projects"`
	Users    []UserResponse         `json:"users"`
}

// GetAllScratchProjectHandler 获取所有Scratch项目 gorails.Wrap 形式
func (h *Handler) GetAllScratchProjectHandler(c *gin.Context, params *GetAllScratchProjectParams) (*GetAllScratchProjectResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取项目总数
	total, err := h.dao.ScratchDao.CountProjects(params.UserID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 获取所有项目列表
	projects, hasMore, err := h.dao.ScratchDao.ListProjectsWithPagination(params.UserID, params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 筛选出projects里面所有的 UserID
	userIDs := make(map[uint]bool)
	for _, project := range projects {
		userIDs[project.UserID] = true
	}
	userIDsList := make([]uint, 0, len(userIDs))
	for userID := range userIDs {
		userIDsList = append(userIDsList, userID)
	}

	// 获取所有userIDs
	users, err := h.dao.UserDao.GetUsersByIDs(userIDsList)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_USER, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return &GetAllScratchProjectResponse{
			Projects: projects,
			Users:    h.OnlyUsersIDAndNickname(users),
		}, &gorails.ResponseMeta{
			Total:   int(total),
			HasNext: hasMore,
		}, nil
}

// OnlyUsersIDAndNickname 格式化用户列表，只返回用户ID和用户名
func (h *Handler) OnlyUsersIDAndNickname(users []model.User) []UserResponse {
	userMap := make([]UserResponse, len(users))
	for i, user := range users {
		nickname := user.Nickname
		if nickname == "" {
			nickname = user.Username
		}
		userMap[i] = UserResponse{
			ID:       user.ID,
			Nickname: nickname,
			Username: user.Username,
		}
	}
	return userMap
}
