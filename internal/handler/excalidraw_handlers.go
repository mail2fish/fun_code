package handler

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
)

// ======================== 文件保存辅助函数 ========================

// saveExcalidrawFile 保存Excalidraw文件，参考asset保存逻辑
// 使用SHA1哈希分成3个目录层级 + 1个文件名
func (h *Handler) saveExcalidrawFile(userID uint, content []byte) (string, string, error) {
	// 计算SHA1
	hash := sha1.Sum(content)
	sha1Hash := hex.EncodeToString(hash[:])

	// 确保SHA1长度足够分割 (40字符)
	if len(sha1Hash) < 40 {
		return "", "", fmt.Errorf("invalid SHA1 hash length")
	}

	// 分成3个目录 + 1个文件名 (每段10个字符)
	dir1 := sha1Hash[:10]               // 前10个字符
	dir2 := sha1Hash[10:20]             // 中间10个字符
	dir3 := sha1Hash[20:30]             // 第三段10个字符
	fileName := sha1Hash[30:] + ".json" // 剩余10个字符作为文件名

	// 构建目录路径
	baseDir := h.dao.ScratchDao.GetScratchBasePath()
	boardDir := filepath.Join(baseDir, "excalidraw", "boards", dir1, dir2, dir3)

	// 创建目录
	if err := os.MkdirAll(boardDir, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create directory: %w", err)
	}

	// 构建完整文件路径
	filePath := filepath.Join(boardDir, fileName)

	// 保存文件
	if err := os.WriteFile(filePath, content, 0644); err != nil {
		return "", "", fmt.Errorf("failed to write file: %w", err)
	}

	// 返回相对路径和SHA1哈希
	relativePath := filepath.Join("excalidraw", "boards", dir1, dir2, dir3, fileName)
	return relativePath, sha1Hash, nil
}

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

	// 保存文件并获取路径和哈希
	filePath, sha1Hash, err := h.saveExcalidrawFile(userID, contentBytes)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, "文件保存失败", err)
	}

	// 创建画板记录
	board := &model.ExcalidrawBoard{
		Name:     params.Name,
		UserID:   userID,
		MD5:      sha1Hash, // 存储SHA1哈希
		FilePath: filePath,
	}

	if err := h.dao.ExcalidrawDao.Create(c.Request.Context(), board); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeCreateFailed, global.ErrorMsgCreateFailed, err)
	}

	return board, nil, nil
}

// ======================== 更新画板 ========================

// UpdateExcalidrawBoardParams 更新画板参数
type UpdateExcalidrawBoardParams struct {
	FileContent map[string]interface{} `json:"file_content" binding:"required"`
}

func (p *UpdateExcalidrawBoardParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

func (h *Handler) UpdateExcalidrawBoardHandler(c *gin.Context, params *UpdateExcalidrawBoardParams) (*model.ExcalidrawBoard, *gorails.ResponseMeta, gorails.Error) {
	// 获取画板ID
	boardIDStr := c.Param("id")
	if boardIDStr == "" {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, "画板ID不能为空", nil)
	}

	// 将字符串ID转换为uint
	boardID, err := strconv.ParseUint(boardIDStr, 10, 32)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeInvalidParams, "画板ID格式错误", err)
	}

	// 获取当前用户ID
	userID := h.getUserID(c)
	if userID == 0 {
		return nil, nil, gorails.NewError(http.StatusUnauthorized, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUnauthorized, global.ErrorMsgUnauthorized, nil)
	}

	// 查找画板
	board, err := h.dao.ExcalidrawDao.GetByID(c.Request.Context(), uint(boardID))
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

	// 保存新文件并获取路径和哈希
	filePath, sha1Hash, err := h.saveExcalidrawFile(userID, contentBytes)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUpdateFailed, "文件保存失败", err)
	}

	// 更新画板记录
	board.MD5 = sha1Hash
	board.FilePath = filePath

	if err := h.dao.ExcalidrawDao.Update(c.Request.Context(), board); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_SCRATCH, global.ErrorCodeUpdateFailed, "更新画板失败", err)
	}

	return board, nil, nil
}
