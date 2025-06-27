package handler

import (
	"errors"
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

	projectCreator, err := h.dao.UserDao.GetUserByID(project.UserID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	projectNickname := projectCreator.Nickname
	if projectNickname == "" {
		projectNickname = projectCreator.Username
	}

	scratchRoute := "/www/user/dashboard"
	if h.hasPermission(c, PermissionManageAll) {
		scratchRoute = "/www/admin/dashboard"
	}

	// 准备模板数据，新项目不需要项目ID
	data := struct {
		CanSaveProject bool
		ProjectID      string
		Host           string
		ProjectTitle   string
		HTMLTitle      string
		CanRemix       bool
		UserName       string
		NickName       string
		IsPlayerOnly   bool
		IsFullScreen   bool
		ProjectHost    string
		AssetHost      string
		ProjectRoute   string
	}{
		CanSaveProject: canSaveProject,
		ProjectID:      params.RawID,                // 新项目使用0作为ID
		Host:           h.config.ScratchEditor.Host, // 从配置中获取 ScratchEditorHost
		ProjectTitle:   project.Name,
		HTMLTitle:      projectNickname + " - " + project.Name,
		CanRemix:       project.UserID == loginedUserID,
		UserName:       user.Username,
		NickName:       user.Nickname,
		IsPlayerOnly:   false,
		IsFullScreen:   false,
		ProjectHost:    h.config.ScratchEditor.Host + "/api/scratch/projects",
		AssetHost:      h.config.ScratchEditor.Host + "/assets/scratch",
		ProjectRoute:   scratchRoute,
	}

	return &TemplateRenderResponse{Tmpl: tmpl, Data: data}, nil, nil
}

// GetOpenScratchProjectParams 打开Scratch项目参数
type GetLessonScratchProjectParams struct {
	ClassID   uint `uri:"class_id"`
	CourseID  uint `uri:"course_id"`
	LessonID  uint `uri:"lesson_id"`
	ProjectID uint `uri:"project_id"`
}

func (p *GetLessonScratchProjectParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

func (h *Handler) GetLessonScratchProjectHandler(c *gin.Context, params *GetLessonScratchProjectParams) (*TemplateRenderResponse, *gorails.ResponseMeta, gorails.Error) {

	loginedUserID := h.getUserID(c)

	// 获取课时信息
	lesson, err := h.dao.LessonDao.GetLesson(params.LessonID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
	}

	// 验证课程ID是否在课时的关联课程中
	isLessonInCourse, err := h.dao.LessonDao.IsLessonInCourse(params.LessonID, params.CourseID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}
	if !isLessonInCourse {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, errors.New("课时不属于指定课程"))
	}

	// 检查 project_id 是否是 lesson_id 的 project_id_1
	if lesson.ProjectID1 != params.ProjectID {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, errors.New("项目ID与课时关联的项目不匹配"))
	}

	// 检查课程是否在指定班级中
	isLessonInClass, err := h.dao.ClassDao.IsLessonInClass(params.ClassID, params.CourseID, params.LessonID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	if !isLessonInClass {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, errors.New("课时所属的课程不在指定班级中"))
	}

	// 获取项目信息
	project, err := h.dao.ScratchDao.GetProject(params.ProjectID)
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
		course, err := h.dao.CourseDao.GetCourse(params.CourseID)
		if err == nil && course.AuthorID == loginedUserID {
			hasPermission = true
		}
	}

	// 4. 检查是否是班级成员（学生或教师）
	if !hasPermission && h.isClassMember(c, params.ClassID) {
		hasPermission = true
	}

	if !hasPermission {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, errors.New("您没有权限访问该项目"))
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

	scratchRoute := "/www/user/dashboard"
	if h.hasPermission(c, PermissionManageAll) {
		scratchRoute = "/www/admin/dashboard"
	}

	// 准备模板数据
	data := struct {
		CanSaveProject bool
		ProjectID      string
		Host           string
		ProjectTitle   string
		HTMLTitle      string
		CanRemix       bool
		UserName       string
		NickName       string
		IsPlayerOnly   bool
		IsFullScreen   bool
		ProjectHost    string
		AssetHost      string
		ProjectRoute   string
	}{
		CanSaveProject: false, // 课时项目通常为只读
		CanRemix:       true,  // 允许基于课时项目创建新项目
		ProjectID:      fmt.Sprintf("%d_%d_%d_%d", params.ClassID, params.CourseID, params.LessonID, params.ProjectID),
		Host:           h.config.ScratchEditor.Host,
		ProjectTitle:   project.Name,
		HTMLTitle:      fmt.Sprintf("Lesson %s - %s", lesson.Title, project.Name),
		UserName:       user.Username,
		NickName:       user.Nickname,
		IsPlayerOnly:   false,
		IsFullScreen:   false,
		ProjectHost:    h.config.ScratchEditor.Host + "/api/student/scratch/projects",
		AssetHost:      h.config.ScratchEditor.Host + "/assets/scratch",
		ProjectRoute:   scratchRoute,
	}

	return &TemplateRenderResponse{Tmpl: tmpl, Data: data}, nil, nil
}
