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
	"github.com/jun/fun_code/internal/custom_error"
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
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80001, "无效的请求参数", err)
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
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80002, "未登录", nil)
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
		return nil, nil, gorails.NewError(http.StatusTooManyRequests, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80003, "操作过于频繁，请稍后再试", nil)
	}

	// 添加当前时间到记录中
	validTimes = append(validTimes, now)
	h.createProjectLimiter[userID] = validTimes
	h.createProjectLimiterLock.Unlock()

	// 序列化数据
	jsonData, err := json.Marshal(params.Data)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80004, "序列化数据失败", err)
	}

	// 调用服务创建项目（使用0表示新项目）
	projectID, err := h.dao.ScratchDao.SaveProject(userID, 0, params.Title, jsonData)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80005, "创建项目失败", err)
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
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80008, "无效的项目ID", nil)
	}

	projectID := splitID[0]

	// 从路径参数获取项目ID
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80009, "无效的项目ID", err)
	}
	p.ID = uint(id)

	// 修改后的请求体结构
	req := make(map[string]interface{})
	if err = c.ShouldBindJSON(&req); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80010, "无效的请求参数", err)
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
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80010, "获取项目失败", err)
	}
	userID := project.UserID
	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80011, "无权限访问", nil)
	}

	// 如果项目ID存在在不允许保存的数组中，则不允许保存
	for _, id := range h.config.Protected.Projects {
		if project.ID == id {
			return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80012, "无权限访问", nil)
		}
	}

	r, err := json.Marshal(params.Data)

	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80013, "序列化数据失败", err)
	}

	// 保存项目
	// 修改服务调用参数
	// 由于 SaveProject 返回 uint 类型，需要将 projectID 声明为 uint
	_, err = h.dao.ScratchDao.SaveProject(userID, params.ID, params.Title, r)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80014, "保存项目失败", err)
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
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80016, "无效的项目ID", nil)
	}

	projectID := splitID[0]
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80016, "无效的项目ID", err)
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
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80017, "未登录", nil)
	}

	// 获取项目创建者ID
	project, err := h.dao.ScratchDao.GetProject(params.ID)

	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80018, "获取项目失败", err)
	}
	// 判断用户是否是项目创建者或者为管理员
	if project.UserID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80019, "无权限访问", nil)
	}

	// 如果项目ID存在在不允许保存的数组中，则不允许保存
	for _, id := range h.config.Protected.Projects {
		if project.ID == id {
			return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80020, "该项目受保护，不能保存", nil)
		}
	}

	// 读取请求体中的二进制数据
	bodyData, err := io.ReadAll(params.Body)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80021, "读取缩略图失败", err)
	}

	if len(bodyData) == 0 {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80022, "读取缩略图失败", nil)
	}

	dirPath := filepath.Join(h.dao.ScratchDao.GetScratchBasePath(), project.FilePath)
	// 构建新的文件路径
	filename := filepath.Join(dirPath, fmt.Sprintf("%d.png", project.ID))

	// 保存文件
	if err := os.WriteFile(filename, bodyData, 0644); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80026, "保存缩略图失败", err)
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
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80024, "无效的项目ID", err)
	}
	p.ID = uint(id)
	return nil
}

func (h *Handler) GetProjectThumbnailHandler(c *gin.Context, params *GetProjectThumbnailParams) ([]byte, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80025, "未登录", nil)
	}

	// 获取项目信息检查权限
	project, err := h.dao.ScratchDao.GetProject(params.ID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80027, "获取项目失败", err)
	}

	// 检查权限
	if project.UserID != userID && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80028, "无权限访问", nil)
	}

	// 使用 scratch 服务的基础路径
	dirPath := filepath.Join(h.dao.ScratchDao.GetScratchBasePath(), project.FilePath)
	// 构建缩略图文件路径
	filename := filepath.Join(dirPath, fmt.Sprintf("%d.png", project.ID))

	// 检查文件是否存在
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80030, "缩略图文件不存在", err)
	}

	// 读取文件内容
	bodyData, err := os.ReadFile(filename)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80031, "读取缩略图文件失败", err)
	}

	// 设置响应头
	c.Header("Content-Type", "image/png")
	c.Header("Content-Length", strconv.Itoa(len(bodyData)))

	return bodyData, nil, nil
}

// ListScratchProjectsParams 列出Scratch项目参数
type ListScratchProjectsParams struct {
	Page     int    `json:"page" form:"page"`
	PageSize int    `json:"page_size" form:"page_size"`
	BeginID  uint   `json:"begin_id" form:"begin_id"`
	Order    string `json:"order" form:"order"`
}

func (p *ListScratchProjectsParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindQuery(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80030, "无效的请求参数", err)
	}
	// 设置默认值
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	if p.Order == "" {
		p.Order = "desc"
	}
	return nil
}

// ListScratchProjectsResponse 列出Scratch项目响应
type ListScratchProjectsResponse struct {
	Projects []ProjectInfo `json:"projects"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

type ProjectInfo struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	UserID    uint      `json:"user_id"`
}

func (h *Handler) ListScratchProjectsHandler(c *gin.Context, params *ListScratchProjectsParams) (*ListScratchProjectsResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80031, "未登录", nil)
	}

	// 使用实际存在的方法获取项目列表
	forward := true
	asc := params.Order == "asc"
	projects, _, err := h.dao.ScratchDao.ListProjectsWithPagination(userID, uint(params.PageSize), params.BeginID, forward, asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80032, "获取项目列表失败", err)
	}

	// 获取总数
	total, err := h.dao.ScratchDao.CountProjects(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80033, "获取项目总数失败", err)
	}

	// 转换为响应格式
	var projectInfos []ProjectInfo
	for _, project := range projects {
		projectInfos = append(projectInfos, ProjectInfo{
			ID:        project.ID,
			Name:      project.Name,
			CreatedAt: project.CreatedAt,
			UpdatedAt: project.UpdatedAt,
			UserID:    project.UserID,
		})
	}

	return &ListScratchProjectsResponse{
		Projects: projectInfos,
		Total:    total,
		Page:     params.Page,
		PageSize: params.PageSize,
	}, nil, nil
}

// SearchScratchParams 搜索Scratch项目参数
type SearchScratchParams struct {
	Keyword string `json:"keyword" form:"keyword" binding:"required"`
	UserID  uint   `json:"user_id" form:"user_id"`
}

func (p *SearchScratchParams) Parse(c *gin.Context) gorails.Error {
	keyword := c.Query("keyword")
	userID := c.Query("user_id")
	userIDInt, err := strconv.Atoi(userID)
	if err != nil {
		userIDInt = 0
	}
	p.Keyword = keyword

	if len(keyword) == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80034, "无效的请求参数", nil)
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
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 80035, "搜索项目失败", err)
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
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 60012, "获取项目总数失败", err)
	}

	// 获取所有项目列表
	projects, hasMore, err := h.dao.ScratchDao.ListProjectsWithPagination(params.UserID, params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.SCRATCH), 60013, "获取项目列表失败", err)
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
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 60014, "获取用户列表失败", err)
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
			Nickname: user.Nickname,
		}
	}
	return userMap
}
