package handler

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
)

// ======================== 画板处理函数 ========================

// ======================== 创建画板 ========================

// CreateExcalidrawBoardParams 创建画板参数
type CreateExcalidrawBoardParams struct {
	Name        string                 `json:"name" binding:"required"`
	FileContent map[string]interface{} `json:"file_content" binding:"required"`
}

func (p *CreateExcalidrawBoardParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

func (h *Handler) CreateExcalidrawBoardHandler(c *gin.Context, params *CreateExcalidrawBoardParams) (*model.ExcalidrawBoard, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 序列化文件内容
	contentBytes, err := json.Marshal(params.FileContent)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, "文件内容格式错误", err)
	}

	// 计算MD5
	hash := md5.Sum(contentBytes)
	md5Hash := hex.EncodeToString(hash[:])

	// 创建画板记录（先创建以获取ID）
	board := &model.ExcalidrawBoard{
		Name:   params.Name,
		UserID: userID,
		MD5:    md5Hash,
	}

	if err := h.dao.ExcalidrawDao.Create(c.Request.Context(), board); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, global.ErrorMsgCreateFailed, err)
	}

	// 使用生成的ID保存文件
	filePath, _, err := h.dao.ExcalidrawDao.SaveExcalidrawFile(userID, board.ID, board.FilePath, contentBytes)
	if err != nil {
		// 如果保存文件失败，删除数据库记录
		h.dao.ExcalidrawDao.Delete(c.Request.Context(), board.ID)
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, "文件保存失败", err)
	}

	// 更新FilePath（虽然应该相同，但确保一致性）
	board.FilePath = filePath

	return board, nil, nil
}

// ======================== 更新画板 ========================

// UpdateExcalidrawBoardParams 更新画板参数
type UpdateExcalidrawBoardParams struct {
	ID          uint
	FileContent map[string]interface{} `json:"file_content" binding:"required"`
}

func (p *UpdateExcalidrawBoardParams) Parse(c *gin.Context) gorails.Error {
	// 获取画板ID
	boardIDStr := c.Param("id")
	if boardIDStr == "" {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, "画板ID不能为空", nil)
	}

	// 将字符串ID转换为uint
	boardID, err := strconv.ParseUint(boardIDStr, 10, 32)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, "画板ID格式错误", err)
	}

	p.ID = uint(boardID)

	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

func (h *Handler) UpdateExcalidrawBoardHandler(c *gin.Context, params *UpdateExcalidrawBoardParams) (*model.ExcalidrawBoard, *gorails.ResponseMeta, gorails.Error) {

	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 查找画板
	board, err := h.dao.ExcalidrawDao.GetByID(c.Request.Context(), uint(params.ID))
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryNotFound, "画板不存在", err)
	}

	// 检查权限
	if board.UserID != userID {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, "无权限操作", nil)
	}

	// 序列化新的文件内容
	contentBytes, err := json.Marshal(params.FileContent)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, "文件内容格式错误", err)
	}

	// 保存新文件并获取哈希（使用现有的FilePath）
	_, md5Hash, err := h.dao.ExcalidrawDao.SaveExcalidrawFile(userID, board.ID, board.FilePath, contentBytes)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUpdateFailed, "文件保存失败", err)
	}

	// 更新画板记录（只更新MD5，FilePath保持不变）
	board.MD5 = md5Hash

	if err := h.dao.ExcalidrawDao.Update(c.Request.Context(), board); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUpdateFailed, "更新画板失败", err)
	}

	return board, nil, nil
}
