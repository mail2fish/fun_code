package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/mermaid"
	"github.com/mail2fish/gorails/gorails"
)

// GetFlowchartScratchParams 获取流程图请求参数
type GetFlowchartScratchParams struct {
	ProjectID string `json:"project_id" uri:"project_id" binding:"required"`
}

func (p *GetFlowchartScratchParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetFlowchartScratchResponse 获取流程图响应
type GetFlowchartScratchResponse struct {
	Mermaid string `json:"mermaid"`
}

// GetFlowchartScratchHandler 获取Scratch项目的流程图
func (h *Handler) GetFlowchartScratchHandler(c *gin.Context, params *GetFlowchartScratchParams) (*GetFlowchartScratchResponse, *gorails.ResponseMeta, gorails.Error) {
	// 将 projectID 字符串转换为 uint 类型
	projectID, err := strconv.ParseUint(params.ProjectID, 10, 64)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 获取项目信息（用于获取项目名称）
	project, err := h.dao.ScratchDao.GetProject(uint(projectID))
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
	}

	// 获取项目创建者ID
	userID, ok := h.dao.ScratchDao.GetProjectUserID(uint(projectID))
	if !ok {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, nil)
	}

	// 判断用户是否是项目创建者或者为管理员
	if userID != h.getUserID(c) && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	}

	// 从数据库获取 scratch project JSON
	projectData, err := h.dao.ScratchDao.GetProjectBinary(uint(projectID), "")
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 解析 JSON 为 mermaid.Project 结构
	var scratchProject mermaid.Project
	if err := json.Unmarshal(projectData, &scratchProject); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, "解析项目数据失败", err)
	}

	// 获取项目名称
	projectName := project.Name
	if projectName == "" {
		projectName = "未命名项目"
	}

	// 调用 GenerateMermaid 方法生成 mermaid 字符串
	mermaidString := mermaid.GenerateMermaid(&scratchProject, projectName)

	// 返回响应
	response := &GetFlowchartScratchResponse{
		Mermaid: mermaidString,
	}

	return response, nil, nil
}

