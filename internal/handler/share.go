package handler

import (
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
	"github.com/jun/fun_code/internal/dao"
	"github.com/jun/fun_code/web"
	"github.com/mail2fish/gorails/gorails"
	"go.uber.org/zap"
)

const (
	MODULE_SHARE gorails.ErrorModule = 2
)

// CreateShareParams 创建分享链接的请求参数
type CreateShareParams struct {
	ProjectID     uint   `json:"project_id" binding:"required"`
	ProjectType   int    `json:"project_type" binding:"required"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	MaxViews      int64  `json:"max_views"`
	AllowDownload bool   `json:"allow_download"`
	AllowRemix    bool   `json:"allow_remix"`
}

func (p *CreateShareParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 1, "无效的请求参数", err)
	}
	return nil
}

// CreateShareResponse 创建分享链接的响应
type CreateShareResponse struct {
	ShareToken string `json:"share_token"`
	Title      string `json:"title"`
	MaxViews   int64  `json:"max_views"`
}

// CreateShareHandler 处理创建分享链接的请求
func (h *Handler) CreateShareHandler(c *gin.Context, params *CreateShareParams) (*CreateShareResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 2, "用户未登录", nil)
	}

	// 获取 shareDao 实例
	shareDao := h.dao.ShareDao

	// 构建创建分享请求
	req := &dao.CreateShareRequest{
		ProjectID:     params.ProjectID,
		ProjectType:   params.ProjectType,
		UserID:        userID,
		Title:         params.Title,
		Description:   params.Description,
		MaxViews:      params.MaxViews,      // 使用前端传入的值，0表示无限制
		AllowDownload: params.AllowDownload, // 使用前端传入的值
		AllowRemix:    params.AllowRemix,    // 使用前端传入的值
	}

	// 如果已存在分享，则更新分享
	share, err := shareDao.GetShareByProject(params.ProjectID, userID)
	if share != nil && err == nil {
		err = shareDao.ReshareProject(share.ID, userID, params.Title, params.Description)
		if err != nil {
			return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 3, "重新分享失败", err)
		}
		return &CreateShareResponse{
			ShareToken: share.ShareToken,
			Title:      share.Title,
			MaxViews:   share.MaxViews,
		}, nil, nil
	}

	// 创建分享
	share, err = shareDao.CreateShare(req)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 3, "创建分享失败", err)
	}

	// 返回响应
	return &CreateShareResponse{
		ShareToken: share.ShareToken,
		Title:      share.Title,
		MaxViews:   share.MaxViews,
	}, nil, nil
}

// ListSharesParams 列出分享请求参数
type ListSharesParams struct {
	PageSize uint `json:"page_size" form:"page_size"` // 每页数量
	BeginID  uint `json:"begin_id" form:"begin_id"`   // 起始ID
	Forward  bool `json:"forward" form:"forward"`     // 是否向前翻页
	Asc      bool `json:"asc" form:"asc"`             // 是否升序
}

func (p *ListSharesParams) Parse(c *gin.Context) gorails.Error {
	// 设置默认值
	p.PageSize = 20
	p.BeginID = 0
	p.Forward = true
	p.Asc = false // 分享列表默认按创建时间倒序（最新的在前）

	// 解析页面大小
	if pageSizeStr := c.DefaultQuery("page_size", "20"); pageSizeStr != "" {
		if pageSize, err := strconv.ParseUint(pageSizeStr, 10, 32); err == nil {
			if pageSize > 0 && pageSize <= 100 { // 限制最大页面大小为100
				p.PageSize = uint(pageSize)
			}
		}
	}

	// 解析起始ID
	if beginIDStr := c.DefaultQuery("begin_id", "0"); beginIDStr != "" {
		if beginID, err := strconv.ParseUint(beginIDStr, 10, 32); err == nil {
			p.BeginID = uint(beginID)
		}
	}

	// 解析翻页方向
	if forwardStr := c.DefaultQuery("forward", "true"); forwardStr != "" {
		p.Forward = forwardStr != "false"
	}

	// 解析排序方向
	if ascStr := c.DefaultQuery("asc", "false"); ascStr != "" {
		p.Asc = ascStr == "true"
	}

	return nil
}

// ShareResponse 分享相关响应
type ShareResponse struct {
	ID             uint   `json:"id"`
	ShareToken     string `json:"share_token"`
	ProjectID      uint   `json:"project_id"`
	ProjectType    int    `json:"project_type"`
	UserID         uint   `json:"user_id"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	ViewCount      int64  `json:"view_count"`
	TotalViewCount int64  `json:"total_view_count"`
	MaxViews       int64  `json:"max_views"`
	IsActive       bool   `json:"is_active"`
	AllowDownload  bool   `json:"allow_download"`
	AllowRemix     bool   `json:"allow_remix"`
	LikeCount      int64  `json:"like_count"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
	// 项目信息
	ProjectName string `json:"project_name,omitempty"`
}

// ListSharesResponse 列出分享响应
type ListSharesResponse struct {
	Shares []*ShareResponse `json:"shares"` // 分享列表
	Users  []UserResponse   `json:"users"`  // 用户列表
}

// ListAllSharesHandler 列出所有分享
// @Summary 分页获取所有分享列表，支持正向和反向翻页
func (h *Handler) ListAllSharesHandler(c *gin.Context, params *ListSharesParams) (*ListSharesResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取 shareDao 实例
	shareDao := h.dao.ShareDao

	// 从数据库获取分享列表（游标分页）
	shares, hasMore, err := shareDao.GetAllShares(params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 5, "获取分享列表失败", err)
	}

	// 筛选出projects里面所有的 UserID
	userIDs := make(map[uint]bool)

	// 构建响应数据
	shareResponses := make([]*ShareResponse, len(shares))

	for i, share := range shares {
		shareResponses[i] = &ShareResponse{
			ID:             share.ID,
			ShareToken:     share.ShareToken,
			ProjectID:      share.ProjectID,
			ProjectType:    share.ProjectType,
			UserID:         share.UserID,
			Title:          share.Title,
			Description:    share.Description,
			ViewCount:      share.ViewCount,
			TotalViewCount: share.TotalViewCount,
			MaxViews:       share.MaxViews,
			IsActive:       share.IsActive,
			AllowDownload:  share.AllowDownload,
			AllowRemix:     share.AllowRemix,
			LikeCount:      share.LikeCount,
			CreatedAt:      share.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:      share.UpdatedAt.Format("2006-01-02 15:04:05"),
		}

		// 如果有关联的项目信息，添加项目名称
		if share.ScratchProject != nil {
			shareResponses[i].ProjectName = share.ScratchProject.Name
		}
		userIDs[share.UserID] = true
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

	userResponses := h.OnlyUsersIDAndNickname(users)

	response := &ListSharesResponse{
		Shares: shareResponses,
		Users:  userResponses,
	}

	return response, &gorails.ResponseMeta{
		HasNext: hasMore,
		Total:   -1, // 游标分页不提供总数，设为-1表示不可用
	}, nil
}

// ListAllSharesHandler 列出所有分享
// @Summary 分页获取所有分享列表，支持正向和反向翻页
func (h *Handler) ListUserSharesHandler(c *gin.Context, params *ListSharesParams) (*ListSharesResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 4, "用户未登录", nil)
	}

	// 获取 shareDao 实例
	shareDao := h.dao.ShareDao

	// 从数据库获取分享列表（游标分页）
	shares, hasMore, err := shareDao.GetUserShares(userID, params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 5, "获取分享列表失败", err)
	}

	// 筛选出projects里面所有的 UserID
	userIDs := make(map[uint]bool)

	// 构建响应数据
	shareResponses := make([]*ShareResponse, len(shares))

	for i, share := range shares {
		shareResponses[i] = &ShareResponse{
			ID:             share.ID,
			ShareToken:     share.ShareToken,
			ProjectID:      share.ProjectID,
			ProjectType:    share.ProjectType,
			UserID:         share.UserID,
			Title:          share.Title,
			Description:    share.Description,
			ViewCount:      share.ViewCount,
			TotalViewCount: share.TotalViewCount,
			MaxViews:       share.MaxViews,
			IsActive:       share.IsActive,
			AllowDownload:  share.AllowDownload,
			AllowRemix:     share.AllowRemix,
			LikeCount:      share.LikeCount,
			CreatedAt:      share.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:      share.UpdatedAt.Format("2006-01-02 15:04:05"),
		}

		// 如果有关联的项目信息，添加项目名称
		if share.ScratchProject != nil {
			shareResponses[i].ProjectName = share.ScratchProject.Name
		}
		userIDs[share.UserID] = true
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

	userResponses := h.OnlyUsersIDAndNickname(users)

	response := &ListSharesResponse{
		Shares: shareResponses,
		Users:  userResponses,
	}

	return response, &gorails.ResponseMeta{
		HasNext: hasMore,
		Total:   -1, // 游标分页不提供总数，设为-1表示不可用
	}, nil
}

// DeleteShareParams 删除分享请求参数
type DeleteShareParams struct {
	ShareID uint `uri:"id" binding:"required"`
}

func (p *DeleteShareParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 6, "无效的分享ID", err)
	}
	return nil
}

// DeleteShareHandler 删除分享
func (h *Handler) DeleteShareHandler(c *gin.Context, params *DeleteShareParams) (*interface{}, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 7, "用户未登录", nil)
	}

	// 获取 shareDao 实例
	shareDao := h.dao.ShareDao

	// 删除分享（软删除）
	err := shareDao.DeleteShare(params.ShareID, userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 8, "删除分享失败", err)
	}

	// 返回空响应表示成功
	var result interface{} = map[string]string{"message": "删除成功"}
	return &result, nil, nil
}

// CheckShareParams 检查分享是否存在的请求参数
type CheckShareParams struct {
	ProjectID uint `form:"project_id" binding:"required"`
}

func (p *CheckShareParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindQuery(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 9, "无效的项目ID", err)
	}
	return nil
}

// CheckShareResponse 检查分享是否存在的响应
type CheckShareResponse struct {
	Exists     bool   `json:"exists"`
	ShareToken string `json:"share_token,omitempty"`
	ShareURL   string `json:"share_url,omitempty"`
	IsActive   bool   `json:"is_active"`
}

// CheckShareHandler 检查项目是否已存在分享
func (h *Handler) CheckShareHandler(c *gin.Context, params *CheckShareParams) (*CheckShareResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 10, "用户未登录", nil)
	}

	// 获取 shareDao 实例
	shareDao := h.dao.ShareDao

	// 检查分享是否存在
	share, err := shareDao.GetShareByProject(params.ProjectID, userID)
	if err != nil {
		// 如果是找不到记录的错误，说明不存在分享
		if dao.ErrShareNotFound.IsError(err) {
			return &CheckShareResponse{
				Exists: false,
			}, nil, nil
		}
		// 其他错误
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 11, "检查分享失败", err)
	}

	// 存在分享，构建完整的分享URL
	shareURL := c.Request.Header.Get("Origin")
	if shareURL == "" {
		shareURL = "http://localhost:3000" // 默认前端地址
	}
	shareURL += "/shares/" + share.ShareToken

	return &CheckShareResponse{
		Exists:     true,
		ShareToken: share.ShareToken,
		ShareURL:   shareURL,
		IsActive:   share.IsActive,
	}, nil, nil
}

// GetShareScratchProjectParams 通过分享链接访问项目的请求参数
type GetShareScratchProjectParams struct {
	Token string `uri:"token" binding:"required"`
}

func (p *GetShareScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 12, "无效的分享链接", err)
	}
	return nil
}

// TemplateRenderResponse 分享项目访问的响应（直接渲染HTML）
type TemplateRenderResponse struct {
	Tmpl *template.Template
	Data interface{}
}

// GetShareScratchProjectHandler 通过分享链接打开Scratch项目
func (h *Handler) GetShareScratchProjectHandler(c *gin.Context, params *GetShareScratchProjectParams) (*TemplateRenderResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取 shareDao 实例
	shareDao := h.dao.ShareDao

	// 通过token获取分享信息
	share, err := shareDao.GetShareByToken(params.Token)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 13, "分享链接不存在或已失效", err)
	}

	// 检查分享是否可访问
	if err := shareDao.CheckShareAccess(share); err != nil {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 14, "分享链接已失效或达到访问限制", err)
	}

	// 记录访问
	if err := shareDao.RecordView(share.ID); err != nil {
		// 不阻止访问，只记录日志
		h.logger.Warn("记录分享访问失败", zap.Error(err))
	}

	// 获取项目信息
	project, err := h.dao.ScratchDao.GetProject(share.ProjectID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 15, "项目不存在", err)
	}

	// 获取项目创建者信息
	user, err := h.dao.UserDao.GetUserByID(share.UserID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 16, "获取用户信息失败", err)
	}

	// 从嵌入的文件系统中获取index.html
	scratchFS, err := fs.Sub(web.ScratchStaticFiles, "scratch/dist")
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 17, "获取静态文件失败", err)
	}

	// 读取index.html文件
	htmlContent, err := fs.ReadFile(scratchFS, "index.html")
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 18, "读取HTML文件失败", err)
	}

	// 将HTML内容转换为字符串
	htmlStr := string(htmlContent)

	// 创建模板
	tmpl, err := template.New("scratch").Parse(htmlStr)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 19, "解析模板失败", err)
	}

	// 准备模板数据，分享项目的特殊配置
	data := struct {
		CanSaveProject bool
		ProjectID      string
		Host           string
		ProjectTitle   string
		CanRemix       bool
		UserName       string
		NickName       string
		IsPlayerOnly   bool
		IsFullScreen   bool
	}{
		CanSaveProject: false,                                        // 分享项目不能保存
		ProjectID:      fmt.Sprintf("%d", share.ProjectID),           // 使用项目ID
		Host:           h.config.ScratchEditor.Host,                  // 从配置中获取 ScratchEditorHost
		ProjectTitle:   fmt.Sprintf("%s (分享)", project.Name),         // 使用项目名称
		CanRemix:       share.AllowRemix,                             // 根据分享设置决定是否允许Remix
		UserName:       fmt.Sprintf("guest_%s", params.Token[:8]),    // 访客用户名
		NickName:       fmt.Sprintf("访客 (查看 %s 的作品)", user.Nickname), // 访客昵称
		IsPlayerOnly:   true,                                         // 分享项目为播放器模式
		IsFullScreen:   false,                                        // 分享项目为全屏模式
	}

	// 返回空响应，因为HTML已经直接写入到c.Writer
	return &TemplateRenderResponse{Tmpl: tmpl, Data: data}, nil, nil
}

func RenderTemplateResponse(c *gin.Context, response *TemplateRenderResponse, meta *gorails.ResponseMeta) {
	// 设置响应头并执行模板
	c.Header("Content-Type", "text/html; charset=utf-8")
	if err := response.Tmpl.Execute(c.Writer, response.Data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "渲染模板失败"})
	}
}

type GetShareScratchProjectInfoResponse struct {
	ShareToken  string `json:"share_token"`
	ProjectID   uint   `json:"project_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	NickName    string `json:"nick_name"`
	ViewCount   int64  `json:"view_count"`
	LikeCount   int64  `json:"like_count"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

func (h *Handler) GetShareScratchProjectInfoHandler(c *gin.Context, params *GetShareScratchProjectParams) (*GetShareScratchProjectInfoResponse, *gorails.ResponseMeta, gorails.Error) {
	shareDao := h.dao.ShareDao

	share, err := shareDao.GetShareByToken(params.Token)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 13, "分享链接不存在或已失效", err)
	}

	user, err := h.dao.UserDao.GetUserByID(share.UserID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_THIRD_PARTY, MODULE_SHARE, 13, "获取用户信息失败", err)
	}

	nickname := user.Nickname
	if nickname == "" {
		nickname = user.Username
	}

	response := &GetShareScratchProjectInfoResponse{
		ShareToken:  share.ShareToken,
		ProjectID:   share.ProjectID,
		Title:       share.Title,
		Description: share.Description,
		NickName:    nickname,
		ViewCount:   share.ViewCount,
		LikeCount:   share.LikeCount,
		CreatedAt:   share.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:   share.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
	return response, nil, nil
}
