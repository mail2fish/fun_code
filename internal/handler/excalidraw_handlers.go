package handler

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"go.uber.org/zap"
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
	// 添加调试日志
	h.logger.Info("创建画板参数",
		zap.String("name", params.Name),
		zap.Any("fileContent", params.FileContent))

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

	// 新建画板：基于当前日期创建目录
	now := time.Now()
	year := now.Format("2006")
	month := now.Format("01")
	day := now.Format("02")

	// 相对路径目录：excalidraw/年/月/日/用户ID
	relativeDir := filepath.Join(year, month, day, fmt.Sprintf("%d", userID))

	// 创建画板记录（先创建以获取ID）
	board := &model.ExcalidrawBoard{
		Name:     params.Name,
		UserID:   userID,
		MD5:      md5Hash,
		FilePath: relativeDir,
	}

	// 添加调试日志
	h.logger.Info("准备创建画板记录",
		zap.String("name", board.Name),
		zap.Uint("userID", board.UserID),
		zap.String("md5", board.MD5),
		zap.String("filePath", board.FilePath))

	if err := h.dao.ExcalidrawDao.Create(c.Request.Context(), board); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, global.ErrorMsgCreateFailed, err)
	}

	// 使用生成的ID保存文件
	_, err = h.dao.ExcalidrawDao.SaveExcalidrawFile(userID, board.ID, board.FilePath, contentBytes)
	if err != nil {
		// 如果保存文件失败，删除数据库记录
		h.dao.ExcalidrawDao.Delete(c.Request.Context(), board.ID)
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, "文件保存失败", err)
	}

	return board, nil, nil
}

// ======================== 更新画板 ========================

// UpdateExcalidrawBoardParams 更新画板参数
type UpdateExcalidrawBoardParams struct {
	ID          uint
	Name        string                 `json:"name,omitempty"`
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
	// 添加调试日志
	h.logger.Info("更新画板参数",
		zap.Uint("id", params.ID),
		zap.String("name", params.Name),
		zap.Any("fileContent", params.FileContent))

	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 查找画板
	board, _, err := h.dao.ExcalidrawDao.GetByID(c.Request.Context(), uint(params.ID))
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryNotFound, "画板不存在", err)
	}

	// 检查权限（所有者或管理员）
	if board.UserID != userID && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, "无权限操作", nil)
	}

	// 序列化新的文件内容
	contentBytes, err := json.Marshal(params.FileContent)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, "文件内容格式错误", err)
	}

	// 保存新文件并获取哈希（使用现有的FilePath）
	md5Hash, err := h.dao.ExcalidrawDao.SaveExcalidrawFile(userID, board.ID, board.FilePath, contentBytes)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUpdateFailed, "文件保存失败", err)
	}

	// 更新画板名称（如果提供）
	if params.Name != "" {
		board.Name = params.Name
		h.logger.Info("更新画板名称",
			zap.Uint("boardID", board.ID),
			zap.String("newName", board.Name))
	}

	// 记录旧的和新的 MD5 值
	oldMD5 := board.MD5
	board.MD5 = md5Hash
	h.logger.Info("更新画板MD5",
		zap.Uint("boardID", board.ID),
		zap.String("oldMD5", oldMD5),
		zap.String("newMD5", md5Hash))

	if err := h.dao.ExcalidrawDao.Update(c.Request.Context(), board); err != nil {
		h.logger.Error("更新画板失败", zap.Error(err), zap.Uint("boardID", board.ID))
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUpdateFailed, "更新画板失败", err)
	}

	h.logger.Info("画板更新成功", zap.Uint("boardID", board.ID), zap.String("finalMD5", board.MD5))

	return board, nil, nil
}

// GetExcalidrawBoardHandler 获取Excalidraw画板
func (h *Handler) GetExcalidrawBoardHandler(c *gin.Context, params *GetExcalidrawBoardParams) (*GetExcalidrawBoardResponse, *gorails.ResponseMeta, gorails.Error) {
	board, boardJson, err := h.dao.ExcalidrawDao.GetByID(c.Request.Context(), params.ID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	loginedUserID := h.getUserID(c)
	// 检查权限（所有者或管理员）
	if board.UserID != loginedUserID && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, errors.New("您没有权限访问该项目"))
	}

	return &GetExcalidrawBoardResponse{
		ID:        board.ID,
		Name:      board.Name,
		BoardJson: boardJson,
		CreatedAt: board.CreatedAt,
		UpdatedAt: board.UpdatedAt,
	}, nil, nil
}

type GetExcalidrawBoardParams struct {
	ID uint `json:"id" uri:"id" binding:"required"`
}

func (p *GetExcalidrawBoardParams) Parse(c *gin.Context) gorails.Error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	p.ID = uint(id)
	return nil
}

type GetExcalidrawBoardResponse struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	BoardJson string `json:"board_json"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

// ======================== 缩略图处理函数 ========================

// ======================== 保存缩略图 ========================

// SaveExcalidrawThumbParams 保存缩略图参数
type SaveExcalidrawThumbParams struct {
	ID      uint   `json:"id" uri:"id" binding:"required"`
	Content []byte // 文件内容
}

func (p *SaveExcalidrawThumbParams) Parse(c *gin.Context) gorails.Error {
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

	// 获取上传的文件
	file, err := c.FormFile("thumbnail")
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, "缩略图文件不能为空", err)
	}

	// 检查文件类型
	if file.Header.Get("Content-Type") != "image/png" {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, "缩略图文件必须是PNG格式", nil)
	}

	// 读取文件内容
	src, err := file.Open()
	if err != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, "打开文件失败", err)
	}
	defer src.Close()

	content, err := io.ReadAll(src)
	if err != nil {
		return gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, "读取文件失败", err)
	}

	p.Content = content
	return nil
}

func (h *Handler) SaveExcalidrawThumbHandler(c *gin.Context, params *SaveExcalidrawThumbParams) (*SaveExcalidrawThumbResponse, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 查找画板
	board, _, err := h.dao.ExcalidrawDao.GetByID(c.Request.Context(), params.ID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryNotFound, "画板不存在", err)
	}

	// 检查权限（所有者或管理员）
	if board.UserID != userID && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, "无权限操作", nil)
	}

	// 保存缩略图文件（使用 params 中已经处理好的文件内容）
	if err := h.dao.ExcalidrawDao.SaveExcalidrawThumb(userID, board.ID, board.FilePath, params.Content); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, "保存缩略图失败", err)
	}

	return &SaveExcalidrawThumbResponse{
		ID:      board.ID,
		Message: "缩略图保存成功",
	}, nil, nil
}

type SaveExcalidrawThumbResponse struct {
	ID      uint   `json:"id"`
	Message string `json:"message"`
}

// ======================== 获取缩略图 ========================

// GetExcalidrawThumbParams 获取缩略图参数
type GetExcalidrawThumbParams struct {
	ID uint `json:"id" uri:"id" binding:"required"`
}

func (p *GetExcalidrawThumbParams) Parse(c *gin.Context) gorails.Error {
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
	return nil
}

func (h *Handler) GetExcalidrawThumbHandler(c *gin.Context, params *GetExcalidrawThumbParams) ([]byte, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 查找画板
	board, _, err := h.dao.ExcalidrawDao.GetByID(c.Request.Context(), params.ID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryNotFound, "画板不存在", err)
	}

	// 检查权限（所有者或管理员）
	if board.UserID != userID && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, "无权限访问", nil)
	}

	// 获取缩略图文件
	content, err := h.dao.ExcalidrawDao.GetExcalidrawThumb(board.ID, board.FilePath)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryNotFound, "缩略图不存在", err)
	}

	// 返回图片数据，缓存设置将在RenderProjectThumbnail中处理
	return content, nil, nil
}

// ======================== 列出画板 ========================

// ListExcalidrawBoardsParams 列出Excalidraw画板参数
type ListExcalidrawBoardsParams struct {
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
}

func (p *ListExcalidrawBoardsParams) Parse(c *gin.Context) gorails.Error {
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

// BoardInfo 画板信息
type BoardInfo struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	UserID    uint      `json:"user_id"`
}

func (h *Handler) ListExcalidrawBoardsHandler(c *gin.Context, params *ListExcalidrawBoardsParams) ([]*model.ExcalidrawBoard, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 获取所有画板列表
	boards, hasMore, err := h.dao.ExcalidrawDao.GetAllBoardsWithPagination(c.Request.Context(), userID, params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 获取总数
	total, err := h.dao.ExcalidrawDao.GetUserBoardCount(c.Request.Context(), userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return boards, &gorails.ResponseMeta{
		Total:   int(total),
		HasNext: hasMore,
	}, nil
}

// ======================== 删除画板 ========================

// DeleteExcalidrawBoardParams 删除画板参数
type DeleteExcalidrawBoardParams struct {
	ID uint `json:"id" uri:"id" binding:"required"`
}

func (p *DeleteExcalidrawBoardParams) Parse(c *gin.Context) gorails.Error {
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
	return nil
}

func (h *Handler) DeleteExcalidrawBoardHandler(c *gin.Context, params *DeleteExcalidrawBoardParams) (*gorails.ResponseEmpty, *gorails.ResponseMeta, gorails.Error) {
	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 查找画板
	board, _, err := h.dao.ExcalidrawDao.GetByID(c.Request.Context(), params.ID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeQueryNotFound, "画板不存在", err)
	}

	// 检查权限（所有者或管理员）
	if board.UserID != userID && !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeNoPermission, "无权限操作", nil)
	}

	// 删除画板（软删除）
	if err := h.dao.ExcalidrawDao.Delete(c.Request.Context(), board.ID); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeDeleteFailed, "删除画板失败", err)
	}

	return &gorails.ResponseEmpty{}, &gorails.ResponseMeta{
		Total:   1,
		HasNext: false,
	}, nil
}
