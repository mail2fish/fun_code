package handler

import (
	"archive/zip"
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"go.uber.org/zap"
)

// MultiFileUploadParams 多文件上传请求参数
type MultiFileUploadParams struct {
	Files        []*multipart.FileHeader `json:"-"`                        // 文件列表
	Names        []string                `json:"names" binding:"required"` // 文件标题列表
	Descriptions []string                `json:"descriptions"`             // 文件描述列表
	SHA1s        []string                `json:"sha1s" binding:"required"` // 文件SHA1列表
	TagIDs       []uint                  `json:"tag_ids"`                  // 文件标签ID列表
}

func (m *MultiFileUploadParams) Parse(c *gin.Context) gorails.Error {

	// 注意：需要在Gin初始化时设置 router.MaxMultipartMemory = 8 << 20 // 8MB
	// 这样可以在解析阶段就限制总的multipart大小

	// 解析multipart表单
	form, err := c.MultipartForm()
	if err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, "解析multipart表单失败", err)
	}
	defer form.RemoveAll() // 清理临时文件

	// 获取上传的文件列表
	files := form.File["files"] // "files" 是前端表单字段名
	if len(files) == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, "没有找到上传的文件", nil)
	}

	// 检查每个文件大小（基于文件头信息的初步检查）
	const maxFileSize = 2 * 1024 * 1024 // 2MB
	for i, file := range files {
		if file.Size > maxFileSize {
			return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams,
				fmt.Sprintf("第%d个文件大小超过限制，最大允许2MB，当前文件大小: %.2fMB", i+1, float64(file.Size)/1024/1024), nil)
		}
	}

	// 获取每个文件对应的metadata
	names := form.Value["names"]
	descriptions := form.Value["descriptions"]
	sha1s := form.Value["sha1s"]
	tagIDStrs := form.Value["tag_ids"]

	// 验证参数数量一致性
	if len(names) != len(files) || len(sha1s) != len(files) {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, "文件数量与metadata数量不匹配", nil)
	}

	// 验证descriptions数量（可以为空，但如果提供则数量要匹配）
	if len(descriptions) > 0 && len(descriptions) != len(files) {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, "descriptions数量与文件数量不匹配", nil)
	}

	// 验证tag_ids数量（可以为空，但如果提供则数量要匹配）
	if len(tagIDStrs) > 0 && len(tagIDStrs) != len(files) {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, "tag_ids数量与文件数量不匹配", nil)
	}

	// 验证SHA1格式
	for i, sha1 := range sha1s {
		if len(sha1) != 40 {
			return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, fmt.Sprintf("第%d个文件的SHA1格式无效", i+1), nil)
		}
	}

	// 如果descriptions为空，用空字符串填充
	if len(descriptions) == 0 {
		descriptions = make([]string, len(files))
	}

	// 解析TagIDs
	var tagIDs []uint
	if len(tagIDStrs) == 0 {
		// 如果没有提供tag_ids，用0填充
		tagIDs = make([]uint, len(files))
	} else {
		tagIDs = make([]uint, len(files))
		for i, tagIDStr := range tagIDStrs {
			tagIDs[i] = parseUintParam(tagIDStr)
		}
	}

	// 设置解析后的参数
	m.Files = files
	m.Names = names
	m.Descriptions = descriptions
	m.SHA1s = sha1s
	m.TagIDs = tagIDs

	return nil
}

// ListFilesParams 列出文件请求参数
type ListFilesParams struct {
	PageSize uint `json:"page_size" form:"page_size"` // 每页数量
	BeginID  uint `json:"begin_id" form:"begin_id"`   // 起始ID
	Forward  bool `json:"forward" form:"forward"`     // 是否向前翻页
	Asc      bool `json:"asc" form:"asc"`             // 是否升序
}

func (p *ListFilesParams) Parse(c *gin.Context) gorails.Error {
	// 设置默认值
	p.PageSize = 20
	p.BeginID = 0
	p.Forward = true
	p.Asc = true

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
	if ascStr := c.DefaultQuery("asc", "true"); ascStr != "" {
		p.Asc = ascStr != "false"
	}

	return nil
}

// FileResponse 文件相关响应
type FileResponse struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Size         int64  `json:"size"`
	TagID        uint   `json:"tag_id"`
	ContentType  uint   `json:"content_type"`
	OriginalName string `json:"original_name"`
}

// ListFilesResponse 列出文件响应
type ListFilesResponse struct {
	Files []*FileResponse `json:"files"` // 文件列表
}

// MultiFileUploadResponse 多文件上传响应
type MultiFileUploadResponse struct {
	SuccessCount int            `json:"success_count"`
	FailedCount  int            `json:"failed_count"`
	TotalCount   int            `json:"total_count"`
	SuccessFiles []FileResponse `json:"success_files"`
	FailedFiles  []FailedFile   `json:"failed_files"`
}

// FailedFile 上传失败的文件信息
type FailedFile struct {
	FileName string `json:"file_name"`
	Error    string `json:"error"`
}

// FileIDParams 下载文件请求参数
type FileIDParams struct {
	FileID uint `json:"file_id" uri:"id" binding:"required"` // 文件ID
}

func (p *FileIDParams) Parse(c *gin.Context) gorails.Error {
	// 解析路径参数
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

func RenderDownloadFile(c *gin.Context, file []byte, meta *gorails.ResponseMeta) {
	c.Data(http.StatusOK, "application/octet-stream", file)
}

// DownloadFileHandler 下载文件
func (h *Handler) DownloadFileHandler(c *gin.Context, params *FileIDParams) ([]byte, *gorails.ResponseMeta, gorails.Error) {
	// 从数据库获取文件信息
	file, err := h.dao.FileDao.GetFile(params.FileID)
	if err != nil {
		return nil, nil, err
	}

	// 检查权限（可选：检查文件是否属于当前用户或用户是否有访问权限）
	// userID := h.getUserID(c)
	// if file.UserID != userID && !h.hasPermission(c, PermissionManageAll) {
	//     return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	// }

	// 构建文件路径
	filePath := h.buildFilePathFromSHA1(file.SHA1, file.ExtName)

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeFileNotFound, "文件不存在于存储系统中", err)
	}

	// 读取文件内容
	fileData, readErr := os.ReadFile(filePath)
	if readErr != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeSystemError, "读取文件失败", readErr)
	}

	// 根据文件类型设置Content-Type
	contentType := getContentTypeHeader(file.ContentType, file.ExtName)

	// 设置响应头
	c.Header("Content-Type", contentType)
	c.Header("Content-Length", strconv.Itoa(len(fileData)))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", file.GetName()))

	return fileData, nil, nil
}

// buildFilePathFromSHA1 根据SHA1值和扩展名构建文件路径
func (h *Handler) buildFilePathFromSHA1(sha1, extName string) string {
	// 使用与上传时相同的目录结构
	if len(sha1) < 40 {
		return filepath.Join(h.config.Storage.BasePath, "files", "invalid")
	}

	part1 := sha1[0:10]  // 前10个字符
	part2 := sha1[10:20] // 第11-20个字符
	part3 := sha1[20:30] // 第21-30个字符
	part4 := sha1[30:40] // 最后10个字符

	fileName := sha1
	if extName != "" {
		fileName = sha1 + extName
	}

	return filepath.Join(h.config.Storage.BasePath, "files", part1, part2, part3, part4, fileName)
}

// getContentTypeHeader 根据文件类型和扩展名获取HTTP Content-Type头
func getContentTypeHeader(contentType uint, extName string) string {
	// 首先根据数据库中的 ContentType 字段
	switch contentType {
	case model.ContentTypeImage:
		switch extName {
		case ".svg":
			return "image/svg+xml"
		case ".jpg", ".jpeg":
			return "image/jpeg"
		case ".png":
			return "image/png"
		case ".gif":
			return "image/gif"
		case ".bmp":
			return "image/bmp"
		case ".webp":
			return "image/webp"
		default:
			return "image/jpeg" // 默认图片类型
		}
	case model.ContentTypeAudio:
		switch extName {
		case ".wav":
			return "audio/wav"
		case ".mp3":
			return "audio/mpeg"
		case ".ogg":
			return "audio/ogg"
		case ".m4a":
			return "audio/mp4"
		default:
			return "audio/wav" // 默认音频类型
		}
	case model.ContentTypeSprite3:
		return "application/json" // Scratch文件通常是JSON格式
	}

	// 后备方案：根据扩展名判断
	switch extName {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".bmp":
		return "image/bmp"
	case ".webp":
		return "image/webp"
	case ".wav":
		return "audio/wav"
	case ".mp3":
		return "audio/mpeg"
	case ".ogg":
		return "audio/ogg"
	case ".m4a":
		return "audio/mp4"
	case ".sb3", ".sb2":
		return "application/json"
	case ".json":
		return "application/json"
	case ".txt":
		return "text/plain"
	case ".pdf":
		return "application/pdf"
	default:
		return "application/octet-stream" // 通用二进制类型
	}
}

// PreviewFileParams 预览文件请求参数
type PreviewFileParams struct {
	FileID uint `json:"file_id" uri:"id" binding:"required"` // 文件ID
}

func (p *PreviewFileParams) Parse(c *gin.Context) gorails.Error {
	// 解析路径参数
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// PreviewFileHandler 预览文件（用于图片等可直接显示的文件）
func (h *Handler) PreviewFileHandler(c *gin.Context, params *PreviewFileParams) ([]byte, *gorails.ResponseMeta, gorails.Error) {
	// 从数据库获取文件信息
	file, err := h.dao.FileDao.GetFile(params.FileID)
	if err != nil {
		return nil, nil, err
	}

	// 检查是否为可预览的文件类型
	if file.ContentType != model.ContentTypeImage && file.ContentType != model.ContentTypeSprite3 {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, "该文件类型不支持预览", nil)
	}

	// 构建缩略图路径
	thumbnailPath := h.buildThumbnailPath(file.SHA1)
	svgThumbnailPath := h.buildSVGThumbnailPath(file.SHA1)
	var filePath string
	var contentType string

	// 优先检查 SVG 缩略图是否存在
	if _, err := os.Stat(svgThumbnailPath); err == nil {
		// SVG 缩略图存在，使用 SVG 缩略图
		filePath = svgThumbnailPath
		contentType = "image/svg+xml"
	} else if _, err := os.Stat(thumbnailPath); err == nil {
		// PNG 缩略图存在，使用 PNG 缩略图
		filePath = thumbnailPath
		contentType = "image/png"
	} else {
		// 缩略图不存在，回退到原始文件
		filePath = h.buildFilePathFromSHA1(file.SHA1, file.ExtName)
		contentType = getContentTypeHeader(file.ContentType, file.ExtName)

		// 检查原始文件是否存在
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeFileNotFound, "文件不存在于存储系统中", err)
		}
	}

	// 读取文件内容
	fileData, readErr := os.ReadFile(filePath)
	if readErr != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeSystemError, "读取文件失败", readErr)
	}

	// 设置响应头（不使用 attachment，直接在浏览器中显示）
	c.Header("Content-Type", contentType)
	c.Header("Content-Length", strconv.Itoa(len(fileData)))
	c.Header("Cache-Control", "public, max-age=3600") // 缓存1小时

	return fileData, nil, nil
}

// ListFilesHandler 列出文件
// @Summary 分页获取文件列表，支持正向和反向翻页
func (h *Handler) ListFilesHandler(c *gin.Context, params *ListFilesParams) (*ListFilesResponse, *gorails.ResponseMeta, gorails.Error) {
	// 检查用户权限
	// if !h.hasPermission(c, PermissionManageAll) {
	// 	return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	// }

	// 从数据库获取文件列表
	files, hasMore, err := h.dao.FileDao.ListFilesWithPagination(params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, err
	}

	// 获取文件总数
	total, err := h.dao.FileDao.CountFiles()
	if err != nil {
		return nil, nil, err
	}

	// 构建响应数据
	fileResponses := make([]*FileResponse, len(files))
	for i, file := range files {
		fileResponses[i] = &FileResponse{
			ID:           file.ID,
			Name:         file.GetName(),
			Description:  file.Description,
			Size:         file.Size,
			TagID:        file.TagID,
			ContentType:  file.ContentType,
			OriginalName: file.OriginalName,
		}
	}

	response := &ListFilesResponse{
		Files: fileResponses,
	}

	return response, &gorails.ResponseMeta{
		HasNext: hasMore,
		Total:   int(total),
	}, nil
}

// DeleteFileHandler 删除文件
func (h *Handler) DeleteFileHandler(c *gin.Context, params *FileIDParams) (*gorails.ResponseEmpty, *gorails.ResponseMeta, gorails.Error) {

	if !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	}

	file, gerr := h.dao.FileDao.GetFile(params.FileID)
	if gerr != nil {
		return nil, nil, gerr
	}

	// 删除原始文件
	filePath := h.buildFilePathFromSHA1(file.SHA1, file.ExtName)
	if err := os.Remove(filePath); err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeSystemError, "删除文件失败", err)
	}

	// 删除缩略图（如果存在）
	thumbnailPath := h.buildThumbnailPath(file.SHA1)
	if _, err := os.Stat(thumbnailPath); err == nil {
		// PNG 缩略图存在，删除它
		if err := os.Remove(thumbnailPath); err != nil {
			h.logger.Error("failed to delete thumbnail", zap.Error(err))
		}
	}

	// 删除 SVG 缩略图（如果存在）
	svgThumbnailPath := h.buildSVGThumbnailPath(file.SHA1)
	if _, err := os.Stat(svgThumbnailPath); err == nil {
		// SVG 缩略图存在，删除它
		if err := os.Remove(svgThumbnailPath); err != nil {
			h.logger.Error("failed to delete SVG thumbnail", zap.Error(err))
		}
	}

	// 从数据库删除文件记录
	gerr = h.dao.FileDao.DeleteFile(params.FileID)
	if gerr != nil {
		return nil, nil, gerr
	}

	return &gorails.ResponseEmpty{}, nil, nil
}

// // UpdateFileHandler 更新文件
// func (h *Handler) UpdateFileHandler(c *gin.Context, params *FileParams) (*FileResponse, *gorails.ResponseMeta, gorails.Error) {
// 	fileID, err := strconv.ParseUint(c.Param("id"), 10, 32)
// 	if err != nil {
// 		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
// 	}

// 	updates := map[string]interface{}{
// 		"name":         params.Name,
// 		"description":  params.Description,
// 		"size":         params.Size,
// 		"tag_id":       params.TagID,
// 		"content_type": params.ContentType,
// 	}

// 	err = h.dao.FileDao.UpdateFile(uint(fileID), updates)
// 	if err != nil {
// 		return nil, nil, err.(gorails.Error)
// 	}

// 	file, err := h.dao.FileDao.GetFile(uint(fileID))
// 	if err != nil {
// 		return nil, nil, err.(gorails.Error)
// 	}

// 	return &FileResponse{
// 		ID:          file.ID,
// 		Name:        file.Name,
// 		Description: file.Description,
// 		Size:        file.Size,
// 		TagID:       file.TagID,
// 		ContentType: file.ContentType,
// 	}, nil, nil
// }

// PostMultiFileUploadHandler 多文件上传处理
// @Summary 处理前端通过multipart/form-data提交的多个文件，每个文件包含独立的sha1、title和description
func (h *Handler) PostMultiFileUploadHandler(c *gin.Context, params *MultiFileUploadParams) (*MultiFileUploadResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 检查用户是否拥有上传文件的权限
	if !h.hasPermission(c, PermissionManageAll) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, nil)
	}

	// 初始化响应结构
	response := &MultiFileUploadResponse{
		TotalCount:   len(params.Files),
		SuccessFiles: make([]FileResponse, 0),
		FailedFiles:  make([]FailedFile, 0),
	}

	// 处理每个文件
	for i, fileHeader := range params.Files {
		fileResp, err := h.processUploadedFileWithSHA1(
			fileHeader,
			userID,
			params.Descriptions[i],
			params.SHA1s[i],
			params.TagIDs[i],
		)
		if err != nil {
			response.FailedFiles = append(response.FailedFiles, FailedFile{
				FileName: fileHeader.Filename,
				Error:    err.Error(),
			})
			response.FailedCount++
		} else {
			response.SuccessFiles = append(response.SuccessFiles, *fileResp)
			response.SuccessCount++
		}
	}

	return response, nil, nil
}

// processUploadedFileWithSHA1 处理带SHA1信息的单个上传文件
func (h *Handler) processUploadedFileWithSHA1(fileHeader *multipart.FileHeader, userID uint, description, expectedSHA1 string, tagID uint) (*FileResponse, gorails.Error) {
	// 验证SHA1格式
	if len(expectedSHA1) != 40 {
		return nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, "SHA1格式无效，应为40个字符", nil)
	}

	uploadDir := h.getSHA1BasedUploadDir(expectedSHA1)

	// 使用SHA1作为文件名
	fileName := expectedSHA1
	// 如果有扩展名，保留扩展名
	if ext := filepath.Ext(fileHeader.Filename); ext != "" {
		fileName = expectedSHA1 + ext
	}
	filePath := filepath.Join(uploadDir, fileName)

	// 检查文件是否存在
	file, _ := h.dao.FileDao.GetFileBySHA1(expectedSHA1)

	// 文件已存在，直接返回
	if file != nil {
		return &FileResponse{
			ID:           file.ID,
			Name:         file.GetName(),
			Description:  file.Description,
			Size:         file.Size,
			TagID:        file.TagID,
			ContentType:  file.ContentType,
			OriginalName: file.OriginalName,
		}, nil
	}

	// 文件不存在，继续保存文件

	// 如果目录不存在，则创建目录
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		// 根据SHA1创建目录结构
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			return nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeCreateFailed, err.Error(), err)
		}
	}

	// 打开上传的文件
	src, err := fileHeader.Open()
	if err != nil {
		return nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeCreateFailed, err.Error(), err)
	}
	defer src.Close()

	var actualFileSize int64

	// 文件不存在，需要流式保存并计算SHA1
	actualFileSize, gerr := h.saveFileWithSHA1Verification(src, filePath, expectedSHA1)
	if gerr != nil {
		os.Remove(filePath) // 清理可能的不完整文件
		return nil, gerr
	}

	// 验证文件大小
	if actualFileSize == 0 {
		return nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, "文件为空", nil)
	}

	// 获取文件类型
	contentType2 := getContentTypeFromExtension(filepath.Ext(fileHeader.Filename))

	// 创建文件记录
	file2 := &model.File{
		ExtName:      filepath.Ext(fileHeader.Filename),
		Description:  description,
		Size:         actualFileSize,
		UserID:       userID,
		TagID:        tagID,
		ContentType:  contentType2,
		SHA1:         expectedSHA1,
		OriginalName: fileHeader.Filename,
	}

	// 保存到数据库
	if err := h.dao.FileDao.CreateFile(file2); err != nil {
		return nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeCreateFailed, err.Error(), err)
	}

	// 异步生成缩略图
	h.generateThumbnail(file2)

	return &FileResponse{
		ID:           file2.ID,
		Name:         file2.GetName(),
		Description:  file2.Description,
		Size:         file2.Size,
		TagID:        file2.TagID,
		ContentType:  file2.ContentType,
		OriginalName: file2.OriginalName,
	}, nil
}

// getSHA1BasedUploadDir 根据SHA1值创建目录路径
func (h *Handler) getSHA1BasedUploadDir(sha1 string) string {
	// 将SHA1值分割成4个部分，每部分用于创建一级目录
	// 例如: sha1 = "1234567890abcdef1234567890abcdef12345678"
	// 分割为: "1234567890" / "abcdef1234" / "567890abcd" / "ef12345678"
	if len(sha1) < 40 {
		return filepath.Join(h.config.Storage.BasePath, "files", "invalid")
	}

	part1 := sha1[0:10]  // 前10个字符
	part2 := sha1[10:20] // 第11-20个字符
	part3 := sha1[20:30] // 第21-30个字符
	part4 := sha1[30:40] // 最后10个字符

	return filepath.Join(h.config.Storage.BasePath, "files", part1, part2, part3, part4)
}

// getContentTypeFromExtension 根据文件扩展名获取ContentType
func getContentTypeFromExtension(ext string) uint {
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg":
		return model.ContentTypeImage // 图片类型
	case ".wav", ".mp3", ".ogg", ".m4a":
		return model.ContentTypeAudio // 音频类型
	case ".sprite3":
		return model.ContentTypeSprite3 // Scratch项目文件
	default:
		return 0 // 其他类型
	}
}

// parseUintParam 解析字符串参数为uint
func parseUintParam(param string) uint {
	if param == "" {
		return 0
	}
	val, err := strconv.ParseUint(param, 10, 32)
	if err != nil {
		return 0
	}
	return uint(val)
}

// saveFileWithSHA1Verification 流式保存文件并验证SHA1
func (h *Handler) saveFileWithSHA1Verification(src io.Reader, filePath, expectedSHA1 string) (int64, gorails.Error) {
	// 创建目标文件
	dst, err := os.Create(filePath)
	if err != nil {
		return 0, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeCreateFailed, err.Error(), err)
	}
	defer dst.Close()

	// 创建SHA1计算器
	hasher := sha1.New()

	// 使用MultiWriter同时写入文件和SHA1计算器
	multiWriter := io.MultiWriter(dst, hasher)

	// 创建带大小限制的流式复制
	const maxFileSize = 2 * 1024 * 1024 // 2MB
	const bufferSize = 64 * 1024        // 64KB buffer

	buffer := make([]byte, bufferSize)
	var totalSize int64

	for {
		n, err := src.Read(buffer)
		if n > 0 {
			totalSize += int64(n)

			// 检查文件大小限制
			if totalSize > maxFileSize {
				return 0, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, fmt.Sprintf("文件大小超过限制，最大允许2MB，当前文件大小: %.2fMB", float64(totalSize)/1024/1024), nil)
			}

			// 写入文件和SHA1计算器
			if _, writeErr := multiWriter.Write(buffer[:n]); writeErr != nil {
				return 0, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeCreateFailed, writeErr.Error(), writeErr)
			}
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeCreateFailed, err.Error(), err)
		}
	}

	// 验证文件大小
	if totalSize == 0 {
		return 0, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, "文件为空", nil)
	}

	// 计算并验证SHA1
	actualSHA1 := hex.EncodeToString(hasher.Sum(nil))
	if actualSHA1 != expectedSHA1 {
		return 0, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, fmt.Sprintf("文件SHA1值不匹配，期望: %s，实际: %s", expectedSHA1, actualSHA1), nil)
	}

	return totalSize, nil
}

// 生成缩略图
func (h *Handler) generateThumbnail(f *model.File) {
	switch f.ContentType {
	case model.ContentTypeImage:
		h.generateImageThumbnail(f)
	case model.ContentTypeAudio:
		// 音频文件暂不生成缩略图
	case model.ContentTypeSprite3:
		h.generateSprite3Thumbnail(f)
	}
}

// generateImageThumbnail 生成图片缩略图
func (h *Handler) generateImageThumbnail(f *model.File) {
	// 50KB 以下的图片不生成缩略图
	const minSizeForThumbnail = 50 * 1024 // 50KB
	if f.Size < minSizeForThumbnail {
		return
	}

	// 构建原始文件路径
	originalPath := h.buildFilePathFromSHA1(f.SHA1, f.ExtName)

	// 检查原始文件是否存在
	if _, err := os.Stat(originalPath); os.IsNotExist(err) {
		return
	}

	// 构建缩略图文件路径
	thumbnailPath := h.buildThumbnailPath(f.SHA1)

	// 如果缩略图已存在，跳过生成
	if _, err := os.Stat(thumbnailPath); err == nil {
		return
	}

	// 确保缩略图目录存在
	thumbnailDir := filepath.Dir(thumbnailPath)
	if err := os.MkdirAll(thumbnailDir, 0755); err != nil {
		return
	}

	// 打开原始图片文件
	file, err := os.Open(originalPath)
	if err != nil {
		return
	}
	defer file.Close()

	// 解码图片
	img, err := h.decodeImage(file, f.ExtName)
	if err != nil {
		return
	}

	// 生成缩略图 (170x128)
	thumbnail := h.resizeImage(img, 170, 128)

	// 保存缩略图
	h.saveThumbnail(thumbnail, thumbnailPath)
}

// generateSprite3Thumbnail 生成Scratch项目缩略图
func (h *Handler) generateSprite3Thumbnail(f *model.File) {
	// 构建原始文件路径
	originalPath := h.buildFilePathFromSHA1(f.SHA1, f.ExtName)

	// 检查原始文件是否存在
	if _, err := os.Stat(originalPath); os.IsNotExist(err) {
		return
	}

	// 构建缩略图文件路径 (Scratch缩略图统一保存为PNG)
	thumbnailPath := h.buildThumbnailPath(f.SHA1)
	svgThumbnailPath := h.buildSVGThumbnailPath(f.SHA1)

	// 如果缩略图已存在（PNG 或 SVG），跳过生成
	if _, err := os.Stat(thumbnailPath); err == nil {
		return
	}
	if _, err := os.Stat(svgThumbnailPath); err == nil {
		return
	}

	// 确保缩略图目录存在
	thumbnailDir := filepath.Dir(thumbnailPath)
	if err := os.MkdirAll(thumbnailDir, 0755); err != nil {
		return
	}
	// 尝试从.sb3文件提取缩略图
	thumbnail, svgData := h.extractScratchThumbnail(originalPath)
	if svgData != nil {
		// 提取到了 SVG 数据，保存为 SVG 缩略图
		baseName := filepath.Base(thumbnailPath)
		sha1 := strings.TrimSuffix(baseName, "_thumb.png")
		h.saveSVGThumbnail(svgData, sha1)
	} else if thumbnail != nil {
		// 提取到了位图，保存为 PNG 缩略图
		h.saveThumbnail(thumbnail, thumbnailPath)
	} else {
		// 没有找到合适的图片，生成默认的Scratch猫缩略图
		h.generateDefaultScratchThumbnail(thumbnailPath)
	}
}

// buildThumbnailPath 构建缩略图文件路径
func (h *Handler) buildThumbnailPath(sha1 string) string {
	if len(sha1) < 40 {
		return filepath.Join(h.config.Storage.BasePath, "files", "invalid")
	}

	part1 := sha1[0:10]
	part2 := sha1[10:20]
	part3 := sha1[20:30]
	part4 := sha1[30:40]

	// 缩略图统一使用.jpg扩展名，除非是PNG格式的Scratch缩略图
	thumbnailExtName := ".png"

	fileName := sha1 + "_thumb" + thumbnailExtName
	return filepath.Join(h.config.Storage.BasePath, "files", part1, part2, part3, part4, fileName)
}

// decodeImage 根据文件扩展名解码图片
func (h *Handler) decodeImage(file *os.File, extName string) (image.Image, error) {
	// 重置文件读取位置到开头
	file.Seek(0, 0)

	switch strings.ToLower(extName) {
	case ".jpg", ".jpeg":
		return jpeg.Decode(file)
	case ".png":
		return png.Decode(file)
	case ".gif":
		return gif.Decode(file)
	default:
		// 尝试自动检测格式
		file.Seek(0, 0)
		img, _, err := image.Decode(file)
		return img, err
	}
}

// resizeImage 简单的图片缩放实现
func (h *Handler) resizeImage(src image.Image, width, height int) image.Image {
	srcBounds := src.Bounds()
	srcW, srcH := srcBounds.Dx(), srcBounds.Dy()

	// 计算保持宽高比的缩放
	ratioW := float64(width) / float64(srcW)
	ratioH := float64(height) / float64(srcH)
	ratio := ratioW
	if ratioH < ratioW {
		ratio = ratioH
	}

	newW := int(float64(srcW) * ratio)
	newH := int(float64(srcH) * ratio)

	// 创建新图片
	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))

	// 简单的最近邻缩放
	for y := 0; y < newH; y++ {
		for x := 0; x < newW; x++ {
			srcX := int(float64(x) / ratio)
			srcY := int(float64(y) / ratio)
			if srcX >= srcW {
				srcX = srcW - 1
			}
			if srcY >= srcH {
				srcY = srcH - 1
			}
			dst.Set(x, y, src.At(srcX+srcBounds.Min.X, srcY+srcBounds.Min.Y))
		}
	}

	return dst
}

// saveThumbnail 保存缩略图
func (h *Handler) saveThumbnail(img image.Image, thumbnailPath string) {
	file, err := os.Create(thumbnailPath)
	if err != nil {
		return
	}
	defer file.Close()

	// 根据文件扩展名决定编码格式
	if strings.HasSuffix(thumbnailPath, ".png") {
		png.Encode(file, img)
	} else {
		// 默认使用JPEG格式，质量设为85
		jpeg.Encode(file, img, &jpeg.Options{Quality: 85})
	}
}

// extractScratchThumbnail 从Scratch项目文件提取缩略图
// 返回值：image.Image 表示位图，[]byte 表示 SVG 数据
func (h *Handler) extractScratchThumbnail(filePath string) (image.Image, []byte) {
	// 打开.sb3文件（ZIP格式）
	r, err := zip.OpenReader(filePath)
	if err != nil {
		h.logger.Error("extractScratchThumbnail", zap.Error(err))
		return nil, nil
	}
	defer r.Close()

	// 从ZIP中提取图片文件
	for _, f := range r.File {
		h.logger.Info("extractScratchThumbnail", zap.String("fileName", f.Name))
		// 文件名后缀如果是图片格式，则提取图片
		if h.isImageFile(f.Name) {
			rc, err := f.Open()
			if err != nil {
				h.logger.Error("extractScratchThumbnail", zap.Error(err))
				continue
			}
			defer rc.Close()

			// 读取图片数据
			imgData, err := io.ReadAll(rc)
			if err != nil {
				h.logger.Error("extractScratchThumbnail", zap.Error(err))
				continue
			}

			// 如果是 SVG 文件，返回 SVG 数据
			if strings.HasSuffix(strings.ToLower(f.Name), ".svg") {
				return nil, imgData // 返回 SVG 数据
			}

			// 解码位图格式
			img, _, err := image.Decode(bytes.NewReader(imgData))
			if err != nil {
				h.logger.Error("extractScratchThumbnail", zap.Error(err))
				continue
			}

			// 生成缩略图尺寸
			return h.resizeImage(img, 200, 200), nil
		}
	}

	return nil, nil
}

// generateDefaultScratchThumbnail 生成默认的Scratch猫缩略图
func (h *Handler) generateDefaultScratchThumbnail(thumbnailPath string) {
	// 创建一个200x200的默认图片（橙色背景）
	img := image.NewRGBA(image.Rect(0, 0, 200, 200))

	// 填充橙色背景 (Scratch主题色)
	orange := color.RGBA{255, 171, 25, 255} // Scratch橙色
	draw.Draw(img, img.Bounds(), &image.Uniform{orange}, image.Point{}, draw.Src)

	// 保存默认缩略图
	h.saveThumbnail(img, thumbnailPath)
}

// isImageFile 检查文件名是否为支持的图片格式
func (h *Handler) isImageFile(fileName string) bool {
	fileName = strings.ToLower(fileName)
	return strings.HasSuffix(fileName, ".png") ||
		strings.HasSuffix(fileName, ".jpg") ||
		strings.HasSuffix(fileName, ".jpeg") ||
		strings.HasSuffix(fileName, ".gif") ||
		strings.HasSuffix(fileName, ".svg")
	// 注意：SVG 直接作为缩略图使用，不进行位图转换
}

// saveSVGThumbnail 保存 SVG 缩略图
func (h *Handler) saveSVGThumbnail(svgData []byte, sha1 string) {
	// 构建 SVG 缩略图路径
	svgThumbnailPath := h.buildSVGThumbnailPath(sha1)

	// 确保目录存在
	thumbnailDir := filepath.Dir(svgThumbnailPath)
	if err := os.MkdirAll(thumbnailDir, 0755); err != nil {
		h.logger.Error("saveSVGThumbnail: failed to create directory", zap.Error(err))
		return
	}

	file, err := os.Create(svgThumbnailPath)
	if err != nil {
		h.logger.Error("saveSVGThumbnail", zap.Error(err))
		return
	}
	defer file.Close()

	_, err = file.Write(svgData)
	if err != nil {
		h.logger.Error("saveSVGThumbnail", zap.Error(err))
	}
}

// buildSVGThumbnailPath 构建 SVG 缩略图文件路径
func (h *Handler) buildSVGThumbnailPath(sha1 string) string {
	if len(sha1) < 40 {
		return filepath.Join(h.config.Storage.BasePath, "files", "invalid")
	}

	part1 := sha1[0:10]
	part2 := sha1[10:20]
	part3 := sha1[20:30]
	part4 := sha1[30:40]

	fileName := sha1 + "_thumb.svg"
	return filepath.Join(h.config.Storage.BasePath, "files", part1, part2, part3, part4, fileName)
}

type SearchFilesParams struct {
	Keyword string
}

func (p *SearchFilesParams) Parse(c *gin.Context) gorails.Error {
	keyword := c.Query("keyword")
	p.Keyword = keyword
	return nil
}

type SearchFilesResponse struct {
	Files []*FileResponse `json:"files"`
}

func (h *Handler) SearchFilesHandler(c *gin.Context, params *SearchFilesParams) (*SearchFilesResponse, *gorails.ResponseMeta, gorails.Error) {
	files, err := h.dao.FileDao.SearchFiles(params.Keyword)
	if err != nil {
		return nil, nil, err
	}
	filesResponse := make([]*FileResponse, len(files))
	for i, file := range files {
		filesResponse[i] = &FileResponse{
			ID:           file.ID,
			Name:         file.GetName(),
			Description:  file.Description,
			Size:         file.Size,
			TagID:        file.TagID,
			ContentType:  file.ContentType,
			OriginalName: file.OriginalName,
		}
	}
	return &SearchFilesResponse{Files: filesResponse}, nil, nil
}
