package handler

import (
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/web"
	"github.com/mail2fish/gorails/gorails"
)

// GetNewScratchProjectResponse 获取新Scratch项目响应
type GetNewScratchProjectResponse struct {
	ProjectID uint `json:"project_id"`
}

func (h *Handler) GetNewScratchProjectHandler(c *gin.Context, params *gorails.EmptyParams) (*GetNewScratchProjectResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 创建新项目
	projectID, err := h.dao.ScratchDao.CreateProject(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, global.ErrorMsgCreateFailed, err)
	}

	return &GetNewScratchProjectResponse{
		ProjectID: projectID,
	}, nil, nil
}

func RenderGetNewScratchProjectResponse(c *gin.Context, response *GetNewScratchProjectResponse, meta *gorails.ResponseMeta) {
	c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("/projects/scratch/open/%d", response.ProjectID))
}

// GetOpenScratchProjectParams 打开Scratch项目参数
type GetOpenScratchProjectParams struct {
	ID    uint
	RawID string
}

func (p *GetOpenScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	rawID := c.Param("id")
	splitID := strings.Split(rawID, "_")

	if len(splitID) == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	projectID := splitID[0]

	// 从 service 获取项目数据
	// 将 projectID 字符串转换为 uint 类型
	id, err := strconv.ParseUint(projectID, 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	p.ID = uint(id)
	p.RawID = rawID
	return nil
}

func (h *Handler) GetOpenScratchProjectHandler(c *gin.Context, params *GetOpenScratchProjectParams) (*TemplateRenderResponse, *gorails.ResponseMeta, gorails.Error) {

	// 获取项目创建者ID
	project, err := h.dao.ScratchDao.GetProject(params.ID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}
	userID := project.UserID
	loginedUserID := h.getUserID(c)
	// 判断用户是否是项目创建者或者为管理员
	if userID != loginedUserID && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	}

	user, err := h.dao.UserDao.GetUserByID(loginedUserID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 从嵌入的文件系统中获取index.html
	scratchFS, err := fs.Sub(web.ScratchStaticFiles, "scratch/dist")
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 读取index.html文件
	htmlContent, err := fs.ReadFile(scratchFS, "index.html")
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 将HTML内容转换为字符串
	htmlStr := string(htmlContent)

	// 创建模板
	tmpl, err := template.New("scratch").Parse(htmlStr)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
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
		IsPlayerOnly   bool
		IsFullScreen   bool
		ProjectHost    string
		AssetHost      string
	}{
		CanSaveProject: canSaveProject,
		ProjectID:      params.RawID,                // 新项目使用0作为ID
		Host:           h.config.ScratchEditor.Host, // 从配置中获取 ScratchEditorHost
		ProjectTitle:   project.Name,
		CanRemix:       project.UserID == loginedUserID,
		UserName:       user.Username,
		NickName:       user.Nickname,
		IsPlayerOnly:   false,
		IsFullScreen:   false,
		ProjectHost:    h.config.ScratchEditor.Host + "/api/scratch/projects",
		AssetHost:      h.config.ScratchEditor.Host + "/assets/scratch",
	}

	return &TemplateRenderResponse{Tmpl: tmpl, Data: data}, nil, nil
}
