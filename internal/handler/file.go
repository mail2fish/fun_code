package handler

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
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

// FileResponse 文件相关响应
type FileResponse struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Size        int64  `json:"size"`
	TagID       uint   `json:"tag_id"`
	ContentType uint   `json:"content_type"`
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

// GetFileHandler 获取文件
func (h *Handler) GetFileHandler(c *gin.Context) (*FileResponse, *gorails.ResponseMeta, gorails.Error) {
	fileID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	file, err := h.dao.FileDao.GetFile(uint(fileID))
	if err != nil {
		return nil, nil, err.(gorails.Error)
	}

	return &FileResponse{
		ID:          file.ID,
		Name:        file.Name,
		Description: file.Description,
		Size:        file.Size,
		TagID:       file.TagID,
		ContentType: file.ContentType,
	}, nil, nil
}

// ListFilesHandler 列出文件
func (h *Handler) ListFilesHandler(c *gin.Context) ([]*FileResponse, *gorails.ResponseMeta, gorails.Error) {
	pageSize, _ := strconv.ParseUint(c.DefaultQuery("page_size", "20"), 10, 32)
	beginID, _ := strconv.ParseUint(c.DefaultQuery("begin_id", "0"), 10, 32)
	forward := c.DefaultQuery("forward", "true") == "true"
	asc := c.DefaultQuery("asc", "true") == "true"

	files, hasMore, err := h.dao.FileDao.ListFilesWithPagination(uint(pageSize), uint(beginID), forward, asc)
	if err != nil {
		return nil, nil, err
	}

	responses := make([]*FileResponse, len(files))
	for i, file := range files {
		responses[i] = &FileResponse{
			ID:          file.ID,
			Name:        file.Name,
			Description: file.Description,
			Size:        file.Size,
			TagID:       file.TagID,
			ContentType: file.ContentType,
		}
	}

	return responses, &gorails.ResponseMeta{
		HasNext: hasMore,
	}, nil
}

// DeleteFileHandler 删除文件
func (h *Handler) DeleteFileHandler(c *gin.Context) (*gorails.ResponseEmpty, *gorails.ResponseMeta, gorails.Error) {
	fileID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	err = h.dao.FileDao.DeleteFile(uint(fileID))
	if err != nil {
		return nil, nil, err.(gorails.Error)
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
			params.Names[i],
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
func (h *Handler) processUploadedFileWithSHA1(fileHeader *multipart.FileHeader, userID uint, name, description, expectedSHA1 string, tagID uint) (*FileResponse, gorails.Error) {
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
	file, gerr := h.dao.FileDao.GetFileBySHA1(expectedSHA1)
	if gerr != nil {
		return nil, gerr
	}

	// 文件已存在，直接返回
	if file != nil {
		return &FileResponse{
			ID:          file.ID,
			Name:        name,
			Description: file.Description,
			Size:        file.Size,
			TagID:       file.TagID,
			ContentType: file.ContentType,
		}, nil
	}

	// 根据SHA1创建目录结构
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeCreateFailed, err.Error(), err)
	}

	// 打开上传的文件
	src, err := fileHeader.Open()
	if err != nil {
		return nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeCreateFailed, err.Error(), err)
	}
	defer src.Close()

	var actualFileSize int64

	// 文件不存在，需要流式保存并计算SHA1
	actualFileSize, gerr = h.saveFileWithSHA1Verification(src, filePath, expectedSHA1)
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
		Name:        expectedSHA1, // 使用SHA1作为文件名
		Description: description,
		Size:        actualFileSize,
		UserID:      userID,
		TagID:       tagID,
		ContentType: contentType2,
	}

	// 保存到数据库
	if err := h.dao.FileDao.CreateFile(file2); err != nil {
		return nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_FILE, global.ErrorCodeCreateFailed, err.Error(), err)
	}

	return &FileResponse{
		ID:          file2.ID,
		Name:        file2.Name,
		Description: file2.Description,
		Size:        file2.Size,
		TagID:       file2.TagID,
		ContentType: file2.ContentType,
	}, nil
}

// getSHA1BasedUploadDir 根据SHA1值创建目录路径
func (h *Handler) getSHA1BasedUploadDir(sha1 string) string {
	// 将SHA1值分割成4个部分，每部分用于创建一级目录
	// 例如: sha1 = "1234567890abcdef1234567890abcdef12345678"
	// 分割为: "1234567890" / "abcdef1234" / "567890abcd" / "ef12345678"
	if len(sha1) < 40 {
		return "./uploads/invalid"
	}

	part1 := sha1[0:10]  // 前10个字符
	part2 := sha1[10:20] // 第11-20个字符
	part3 := sha1[20:30] // 第21-30个字符
	part4 := sha1[30:40] // 最后10个字符

	return filepath.Join("./uploads", part1, part2, part3, part4)
}

// getContentTypeFromExtension 根据文件扩展名获取ContentType
func getContentTypeFromExtension(ext string) uint {
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp":
		return model.ContentTypeImage // 图片类型
	case ".wav", ".mp3", ".ogg", ".m4a":
		return model.ContentTypeAudio // 音频类型
	case ".sb3", ".sb2":
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
