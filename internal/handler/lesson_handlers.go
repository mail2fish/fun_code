package handler

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/dao"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"gorm.io/gorm"
)

// CreateLessonParams 创建课时请求参数
type CreateLessonParams struct {
	CourseIDs    []uint                `json:"course_ids" form:"course_ids"` // 关联的课程ID列表（可选）
	Title        string                `json:"title" form:"title" binding:"required"`
	Content      string                `json:"content" form:"content"`
	FlowChartID  uint                  `json:"flow_chart_id" form:"flow_chart_id"`
	ProjectType  string                `json:"project_type" form:"project_type"`
	ProjectID1   uint                  `json:"project_id_1" form:"project_id_1"`
	ProjectID2   uint                  `json:"project_id_2" form:"project_id_2"`
	Duration     int                   `json:"duration" form:"duration"`
	Difficulty   string                `json:"difficulty" form:"difficulty"`
	Description  string                `json:"description" form:"description"`
	DocumentFile *multipart.FileHeader `json:"-" form:"document_file"` // 文档文件
	Video1File   *multipart.FileHeader `json:"-" form:"video_1_file"`  // 视频1文件
	Video2File   *multipart.FileHeader `json:"-" form:"video_2_file"`  // 视频2文件
	Video3File   *multipart.FileHeader `json:"-" form:"video_3_file"`  // 视频3文件
}

func (p *CreateLessonParams) Parse(c *gin.Context) gorails.Error {
	// 解析JSON字段
	if err := c.ShouldBind(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 特殊处理 course_ids 字段（multipart form 中的数组）
	// 检查是否存在 course_ids 字段（无论值是否为空）
	if courseIDsStr, exists := c.GetPostForm("course_ids"); exists {
		// 清空原有的值
		p.CourseIDs = []uint{}
		// 如果值不为空，解析逗号分隔的字符串
		if courseIDsStr != "" {
			parts := strings.Split(courseIDsStr, ",")
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if part != "" {
					if courseID, err := strconv.ParseUint(part, 10, 32); err == nil {
						p.CourseIDs = append(p.CourseIDs, uint(courseID))
					}
				}
			}
		}
		// 如果值为空，CourseIDs 已经被设置为空数组，这是我们想要的
	}

	// 解析文件字段
	form, err := c.MultipartForm()
	if err == nil {
		defer form.RemoveAll()

		// 解析文档文件
		if files := form.File["document_file"]; len(files) > 0 {
			p.DocumentFile = files[0]
		}

		// 解析视频文件
		if files := form.File["video_1_file"]; len(files) > 0 {
			p.Video1File = files[0]
		}

		if files := form.File["video_2_file"]; len(files) > 0 {
			p.Video2File = files[0]
		}

		if files := form.File["video_3_file"]; len(files) > 0 {
			p.Video3File = files[0]
		}
	}

	return nil
}

// CreateLessonResponse 创建课时响应
type CreateLessonResponse struct {
	Message   string `json:"message"`
	ID        uint   `json:"id"`
	CourseIDs []uint `json:"course_ids"`
	Title     string `json:"title"`
	Content   string `json:"content"`

	DocumentName string `json:"document_name"`
	DocumentPath string `json:"document_path"`
	FlowChartID  uint   `json:"flow_chart_id"`
	ProjectType  string `json:"project_type"`
	ProjectID1   uint   `json:"project_id_1"`
	ProjectID2   uint   `json:"project_id_2"`
	VideoPath1   string `json:"video_path_1"`
	VideoPath2   string `json:"video_path_2"`
	VideoPath3   string `json:"video_path_3"`
	Duration     int    `json:"duration"`
	Difficulty   string `json:"difficulty"`
	Description  string `json:"description"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// CreateLessonHandler 创建课时
func (h *Handler) CreateLessonHandler(c *gin.Context, params *CreateLessonParams) (*CreateLessonResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 如果提供了课程ID，验证课程是否存在且用户有权限
	var validCourseIDs []uint
	for _, courseID := range params.CourseIDs {
		if courseID > 0 {
			course, err := h.dao.CourseDao.GetCourse(courseID)
			if err != nil || course.AuthorID != userID {
				return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, fmt.Errorf("无权限操作课程 %d", courseID))
			}
			validCourseIDs = append(validCourseIDs, courseID)
		}
	}

	// 处理文件上传
	var documentPath, documentName, video1Path, video2Path, video3Path string

	// 处理文档文件
	if params.DocumentFile != nil {
		savedPath, gerr := h.saveUploadedFile(params.DocumentFile, userID)
		if gerr != nil {
			return nil, nil, gerr
		}
		documentPath = savedPath
		documentName = params.DocumentFile.Filename
	}

	// 处理视频文件
	if params.Video1File != nil {
		savedPath, gerr := h.saveUploadedFile(params.Video1File, userID)
		if gerr != nil {
			return nil, nil, gerr
		}
		video1Path = savedPath
	}

	if params.Video2File != nil {
		savedPath, gerr := h.saveUploadedFile(params.Video2File, userID)
		if gerr != nil {
			return nil, nil, gerr
		}
		video2Path = savedPath
	}

	if params.Video3File != nil {
		savedPath, gerr := h.saveUploadedFile(params.Video3File, userID)
		if gerr != nil {
			return nil, nil, gerr
		}
		video3Path = savedPath
	}

	// 构建课时对象
	lesson := &model.Lesson{
		Title:        params.Title,
		Content:      params.Content,
		DocumentName: documentName,
		DocumentPath: documentPath,
		FlowChartID:  params.FlowChartID,
		ProjectType:  params.ProjectType,
		ProjectID1:   params.ProjectID1,
		ProjectID2:   params.ProjectID2,
		Video1:       video1Path,
		Video2:       video2Path,
		Video3:       video3Path,
		Duration:     params.Duration,
		Difficulty:   params.Difficulty,
		Description:  params.Description,
	}

	// 调用服务层创建课时
	if err := h.dao.LessonDao.CreateLesson(lesson); err != nil {
		// 如果创建失败，清理已上传的文件
		h.cleanupUploadedFiles([]string{documentPath, video1Path, video2Path, video3Path})
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeCreateFailed, global.ErrorMsgInsertFailed, err)
	}

	// 将课时关联到课程
	for _, courseID := range validCourseIDs {
		if err := h.dao.LessonDao.AddLessonToCourse(lesson.ID, courseID, 0); err != nil {
			// 如果关联失败，记录错误但不返回失败（课时已创建成功）
			// TODO: 可以考虑记录日志或者回滚操作
		}
	}

	response := &CreateLessonResponse{
		Message:   "课时创建成功",
		ID:        lesson.ID,
		CourseIDs: validCourseIDs,
		Title:     lesson.Title,
		Content:   lesson.Content,

		DocumentName: lesson.DocumentName,
		DocumentPath: lesson.DocumentPath,
		FlowChartID:  lesson.FlowChartID,
		ProjectType:  lesson.ProjectType,
		ProjectID1:   lesson.ProjectID1,
		ProjectID2:   lesson.ProjectID2,
		VideoPath1:   lesson.Video1,
		VideoPath2:   lesson.Video2,
		VideoPath3:   lesson.Video3,
		Duration:     lesson.Duration,
		Difficulty:   lesson.Difficulty,
		Description:  lesson.Description,
		CreatedAt:    time.Unix(lesson.CreatedAt, 0).Format(time.RFC3339),
		UpdatedAt:    time.Unix(lesson.UpdatedAt, 0).Format(time.RFC3339),
	}

	return response, nil, nil
}

// saveUploadedFile 保存上传的文件并返回文件路径
func (h *Handler) saveUploadedFile(fileHeader *multipart.FileHeader, userID uint) (string, gorails.Error) {
	// 检查文件大小限制 (10MB)
	const maxFileSize = 10 * 1024 * 1024 // 10MB
	if fileHeader.Size > maxFileSize {
		return "", gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, fmt.Sprintf("文件大小超过限制，最大允许10MB，当前文件大小: %.2fMB", float64(fileHeader.Size)/1024/1024), nil)
	}

	// 打开上传的文件
	src, err := fileHeader.Open()
	if err != nil {
		return "", gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeCreateFailed, "打开上传文件失败", err)
	}
	defer src.Close()

	// 计算文件的SHA1值
	sha1Hash, gerr := h.calculateFileSHA1(src)
	if gerr != nil {
		return "", gerr
	}

	// 重新打开文件用于保存（因为计算SHA1后指针已移动）
	src.Close()
	src, err = fileHeader.Open()
	if err != nil {
		return "", gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeCreateFailed, "重新打开上传文件失败", err)
	}
	defer src.Close()

	// 根据SHA1创建目录路径（3级目录）- 使用lessons子目录
	uploadDir := h.getLessonUploadDir(sha1Hash)

	// 创建目录
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeCreateFailed, "创建目录失败", err)
	}

	// 构建文件名：SHA1 + 原始扩展名
	fileName := sha1Hash + filepath.Ext(fileHeader.Filename)
	filePath := filepath.Join(uploadDir, fileName)

	// 检查文件是否已存在（基于SHA1去重）
	if _, err := os.Stat(filePath); err == nil {
		// 文件已存在，直接返回路径
		return filePath, nil
	}

	// 保存文件
	dst, err := os.Create(filePath)
	if err != nil {
		return "", gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeCreateFailed, "创建目标文件失败", err)
	}
	defer dst.Close()

	// 复制文件内容
	if _, err := io.Copy(dst, src); err != nil {
		os.Remove(filePath) // 清理不完整文件
		return "", gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeCreateFailed, "保存文件失败", err)
	}

	return filePath, nil
}

// calculateFileSHA1 计算文件的SHA1值
func (h *Handler) calculateFileSHA1(src io.Reader) (string, gorails.Error) {
	hasher := sha1.New()
	if _, err := io.Copy(hasher, src); err != nil {
		return "", gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeCreateFailed, "计算文件SHA1失败", err)
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// getLessonUploadDir 根据SHA1值创建课时文件目录路径
func (h *Handler) getLessonUploadDir(sha1 string) string {
	if len(sha1) < 40 {
		return filepath.Join(h.config.Storage.BasePath, "lessons", "invalid")
	}

	part1 := sha1[0:10]  // 前10个字符
	part2 := sha1[10:20] // 第11-20个字符
	part3 := sha1[20:30] // 第21-30个字符
	part4 := sha1[30:40] // 最后10个字符

	return filepath.Join(h.config.Storage.BasePath, "lessons", part1, part2, part3, part4)
}

// cleanupUploadedFiles 清理上传的文件（在创建失败时调用）
func (h *Handler) cleanupUploadedFiles(filePaths []string) {
	for _, filePath := range filePaths {
		if filePath != "" {
			if err := os.Remove(filePath); err != nil {
				// 记录日志但不抛出错误，避免影响主要的错误返回
				fmt.Printf("Warning: failed to cleanup file %s: %v\n", filePath, err)
			}
		}
	}
}

// UpdateLessonParams 更新课时请求参数
type UpdateLessonParams struct {
	LessonID      uint                  `json:"lesson_id" uri:"lesson_id" binding:"required"`
	CourseIDs     []uint                `json:"course_ids" form:"course_ids"` // 关联的课程ID列表
	Title         string                `json:"title" form:"title"`
	Content       string                `json:"content" form:"content"`
	FlowChartID   *uint                 `json:"flow_chart_id" form:"flow_chart_id"`
	ProjectType   string                `json:"project_type" form:"project_type"`
	ProjectID1    *uint                 `json:"project_id_1" form:"project_id_1"`
	ProjectID2    *uint                 `json:"project_id_2" form:"project_id_2"`
	Duration      *int                  `json:"duration" form:"duration"`
	Difficulty    string                `json:"difficulty" form:"difficulty"`
	Description   string                `json:"description" form:"description"`
	UpdatedAt     int64                 `json:"updated_at" form:"updated_at"`         // 乐观锁
	DocumentFile  *multipart.FileHeader `json:"-" form:"document_file"`               // 文档文件(可选，如果提供则替换现有文件)
	Video1File    *multipart.FileHeader `json:"-" form:"video_1_file"`                // 视频1文件(可选)
	Video2File    *multipart.FileHeader `json:"-" form:"video_2_file"`                // 视频2文件(可选)
	Video3File    *multipart.FileHeader `json:"-" form:"video_3_file"`                // 视频3文件(可选)
	ClearDocument bool                  `json:"clear_document" form:"clear_document"` // 清除文档文件
	ClearVideo1   bool                  `json:"clear_video_1" form:"clear_video_1"`   // 清除视频1
	ClearVideo2   bool                  `json:"clear_video_2" form:"clear_video_2"`   // 清除视频2
	ClearVideo3   bool                  `json:"clear_video_3" form:"clear_video_3"`   // 清除视频3
}

func (p *UpdateLessonParams) Parse(c *gin.Context) gorails.Error {
	// 解析URI参数
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 解析表单字段
	if err := c.ShouldBind(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 特殊处理 course_ids 字段（multipart form 中的数组）
	// 检查是否存在 course_ids 字段（无论值是否为空）
	if courseIDsStr, exists := c.GetPostForm("course_ids"); exists {
		// 清空原有的值
		p.CourseIDs = []uint{}
		// 如果值不为空，解析逗号分隔的字符串
		if courseIDsStr != "" {
			parts := strings.Split(courseIDsStr, ",")
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if part != "" {
					if courseID, err := strconv.ParseUint(part, 10, 32); err == nil {
						p.CourseIDs = append(p.CourseIDs, uint(courseID))
					}
				}
			}
		}
		// 如果值为空，CourseIDs 已经被设置为空数组，这是我们想要的
	}

	// 手动验证必需的字段
	if p.UpdatedAt == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, "updated_at字段为必填项", nil)
	}

	// 解析文件字段
	form, err := c.MultipartForm()
	if err == nil {
		defer form.RemoveAll()

		// 解析文档文件
		if files := form.File["document_file"]; len(files) > 0 {
			p.DocumentFile = files[0]
		}

		// 解析视频文件
		if files := form.File["video_1_file"]; len(files) > 0 {
			p.Video1File = files[0]
		}

		if files := form.File["video_2_file"]; len(files) > 0 {
			p.Video2File = files[0]
		}

		if files := form.File["video_3_file"]; len(files) > 0 {
			p.Video3File = files[0]
		}
	}

	return nil
}

// UpdateLessonResponse 更新课时响应
type UpdateLessonResponse struct {
	Message   string `json:"message"`
	ID        uint   `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	UpdatedAt string `json:"updated_at"`
}

// UpdateLessonHandler 更新课时
func (h *Handler) UpdateLessonHandler(c *gin.Context, params *UpdateLessonParams) (*UpdateLessonResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 获取当前课时信息（用于权限检查和文件清理）
	currentLesson, err := h.dao.LessonDao.GetLesson(params.LessonID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
	}

	// 验证权限（通过课时关联的课程检查）
	courses, err := h.dao.LessonDao.GetLessonCourses(params.LessonID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 检查用户是否有权限修改该课时
	// 1. 如果课时没有关联任何课程，只有管理员可以操作
	// 2. 如果课时关联了课程，必须是其中任一关联课程的作者
	hasPermission := false

	if len(courses) == 0 {
		// 没有关联课程的课时，检查是否为管理员
		userInfo, err := h.dao.UserDao.GetUserByID(userID)
		if err != nil || userInfo.Role != "admin" {
			hasPermission = false
		} else {
			hasPermission = true
		}
	} else {
		// 有关联课程的课时，检查是否为任一课程的作者
		for _, course := range courses {
			if course.AuthorID == userID {
				hasPermission = true
				break
			}
		}
	}

	if !hasPermission {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, errors.New("无权限操作此课时"))
	}

	// 处理文件上传
	var newDocumentPath, newDocumentName, newVideo1Path, newVideo2Path, newVideo3Path string
	var filesToCleanup []string

	// 处理文档文件
	if params.ClearDocument {
		// 清除文档文件
		newDocumentPath = ""
		newDocumentName = ""
		if currentLesson.DocumentPath != "" {
			filesToCleanup = append(filesToCleanup, currentLesson.DocumentPath)
		}
	} else if params.DocumentFile != nil {
		// 上传新文档文件
		savedPath, gerr := h.saveUploadedFile(params.DocumentFile, userID)
		if gerr != nil {
			return nil, nil, gerr
		}
		newDocumentPath = savedPath
		newDocumentName = params.DocumentFile.Filename
		// 标记旧文件待清理
		if currentLesson.DocumentPath != "" && currentLesson.DocumentPath != newDocumentPath {
			filesToCleanup = append(filesToCleanup, currentLesson.DocumentPath)
		}
	}

	// 处理视频1文件
	if params.ClearVideo1 {
		newVideo1Path = ""
		if currentLesson.Video1 != "" {
			filesToCleanup = append(filesToCleanup, currentLesson.Video1)
		}
	} else if params.Video1File != nil {
		savedPath, gerr := h.saveUploadedFile(params.Video1File, userID)
		if gerr != nil {
			return nil, nil, gerr
		}
		newVideo1Path = savedPath
		if currentLesson.Video1 != "" && currentLesson.Video1 != newVideo1Path {
			filesToCleanup = append(filesToCleanup, currentLesson.Video1)
		}
	}

	// 处理视频2文件
	if params.ClearVideo2 {
		newVideo2Path = ""
		if currentLesson.Video2 != "" {
			filesToCleanup = append(filesToCleanup, currentLesson.Video2)
		}
	} else if params.Video2File != nil {
		savedPath, gerr := h.saveUploadedFile(params.Video2File, userID)
		if gerr != nil {
			return nil, nil, gerr
		}
		newVideo2Path = savedPath
		if currentLesson.Video2 != "" && currentLesson.Video2 != newVideo2Path {
			filesToCleanup = append(filesToCleanup, currentLesson.Video2)
		}
	}

	// 处理视频3文件
	if params.ClearVideo3 {
		newVideo3Path = ""
		if currentLesson.Video3 != "" {
			filesToCleanup = append(filesToCleanup, currentLesson.Video3)
		}
	} else if params.Video3File != nil {
		savedPath, gerr := h.saveUploadedFile(params.Video3File, userID)
		if gerr != nil {
			return nil, nil, gerr
		}
		newVideo3Path = savedPath
		if currentLesson.Video3 != "" && currentLesson.Video3 != newVideo3Path {
			filesToCleanup = append(filesToCleanup, currentLesson.Video3)
		}
	}

	// 构建更新数据
	updates := make(map[string]interface{})
	if params.Title != "" {
		updates["title"] = params.Title
	}
	if params.Content != "" {
		updates["content"] = params.Content
	}
	if params.FlowChartID != nil {
		updates["flow_chart_id"] = *params.FlowChartID
	}
	if params.ProjectType != "" {
		updates["project_type"] = params.ProjectType
	}
	if params.ProjectID1 != nil {
		updates["ProjectID1"] = *params.ProjectID1
	}
	if params.ProjectID2 != nil {
		updates["ProjectID2"] = *params.ProjectID2
	}
	if params.Duration != nil {
		updates["duration"] = *params.Duration
	}
	if params.Difficulty != "" {
		updates["difficulty"] = params.Difficulty
	}
	if params.Description != "" {
		updates["description"] = params.Description
	}

	// 添加文件相关的更新
	if params.ClearDocument || params.DocumentFile != nil {
		updates["document_name"] = newDocumentName
		updates["document_path"] = newDocumentPath
	}
	if params.ClearVideo1 || params.Video1File != nil {
		updates["video_1"] = newVideo1Path
	}
	if params.ClearVideo2 || params.Video2File != nil {
		updates["video_2"] = newVideo2Path
	}
	if params.ClearVideo3 || params.Video3File != nil {
		updates["video_3"] = newVideo3Path
	}

	// 调用服务层更新课时
	if err := h.dao.LessonDao.UpdateLesson(params.LessonID, userID, params.UpdatedAt, updates); err != nil {
		// 更新失败，清理新上传的文件
		h.cleanupUploadedFiles([]string{newDocumentPath, newVideo1Path, newVideo2Path, newVideo3Path})

		if err.Error() == "课时已被其他用户修改，请刷新后重试" {
			return nil, nil, gorails.NewError(http.StatusConflict, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeUpdateConflict, "课时已被其他用户修改，请刷新后重试", err)
		}
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeUpdateFailed, global.ErrorMsgUpdateFailed, err)
	}

	// 检查是否需要更新课程关联（如果前端传递了course_ids字段，无论是否为空）
	// 通过检查PostForm来确定是否明确传递了course_ids参数
	_, courseIDsProvided := c.GetPostForm("course_ids")
	if courseIDsProvided {
		// 验证所有课程ID的权限
		var validCourseIDs []uint
		for _, courseID := range params.CourseIDs {
			if courseID > 0 {
				course, err := h.dao.CourseDao.GetCourse(courseID)
				if err != nil || course.AuthorID != userID {
					// 如果课程不存在或无权限，跳过该课程（但不返回错误）
					continue
				}
				validCourseIDs = append(validCourseIDs, courseID)
			}
		}

		// 清除现有的课程关联
		currentCourses, err := h.dao.LessonDao.GetLessonCourses(params.LessonID)
		if err == nil {
			for _, course := range currentCourses {
				h.dao.LessonDao.RemoveLessonFromCourse(params.LessonID, course.ID)
			}
		}

		// 建立新的课程关联
		for _, courseID := range validCourseIDs {
			h.dao.LessonDao.AddLessonToCourse(params.LessonID, courseID, 0)
		}
	}

	// 更新成功后，清理旧文件
	h.cleanupUploadedFiles(filesToCleanup)

	// 获取更新后的课时信息
	lesson, err := h.dao.LessonDao.GetLesson(params.LessonID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	response := &UpdateLessonResponse{
		Message:   "课时更新成功",
		ID:        lesson.ID,
		Title:     lesson.Title,
		Content:   lesson.Content,
		UpdatedAt: time.Unix(lesson.UpdatedAt, 0).Format(time.RFC3339),
	}

	return response, nil, nil
}

// GetLessonParams 获取课时详情请求参数
type GetLessonParams struct {
	LessonID uint `json:"lesson_id" uri:"lesson_id" binding:"required"`
}

func (p *GetLessonParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetLessonResponse 获取课时详情响应
type GetLessonResponse struct {
	ID      uint   `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
	Courses []struct {
		ID          uint   `json:"id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		SortOrder   int    `json:"sort_order"`
	} `json:"courses,omitempty"`

	DocumentName string `json:"document_name"`
	DocumentPath string `json:"document_path"`
	FlowChartID  uint   `json:"flow_chart_id"`
	ProjectType  string `json:"project_type"`
	ProjectID1   uint   `json:"project_id_1"`
	ProjectID2   uint   `json:"project_id_2"`
	VideoPath1   string `json:"video_path_1"`
	VideoPath2   string `json:"video_path_2"`
	VideoPath3   string `json:"video_path_3"`
	Duration     int    `json:"duration"`
	Difficulty   string `json:"difficulty"`
	Description  string `json:"description"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// GetLessonHandler 获取课时详情
func (h *Handler) GetLessonHandler(c *gin.Context, params *GetLessonParams) (*GetLessonResponse, *gorails.ResponseMeta, gorails.Error) {
	lesson, err := h.dao.LessonDao.GetLesson(params.LessonID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || err.Error() == "课时不存在" {
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	response := &GetLessonResponse{
		ID:      lesson.ID,
		Title:   lesson.Title,
		Content: lesson.Content,

		DocumentName: lesson.DocumentName,
		DocumentPath: lesson.DocumentPath,
		FlowChartID:  lesson.FlowChartID,
		ProjectType:  lesson.ProjectType,
		ProjectID1:   lesson.ProjectID1,
		ProjectID2:   lesson.ProjectID2,
		VideoPath1:   lesson.Video1,
		VideoPath2:   lesson.Video2,
		VideoPath3:   lesson.Video3,
		Duration:     lesson.Duration,
		Difficulty:   lesson.Difficulty,
		Description:  lesson.Description,
		CreatedAt:    time.Unix(lesson.CreatedAt, 0).Format(time.RFC3339),
		UpdatedAt:    time.Unix(lesson.UpdatedAt, 0).Format(time.RFC3339),
	}

	// 获取关联的课程信息（通过多对多关系）
	if len(lesson.Courses) > 0 {
		for _, course := range lesson.Courses {
			// 需要通过关联表获取排序信息，这里暂时设为0
			// TODO: 如果需要排序信息，需要从 lesson_courses 表中获取
			response.Courses = append(response.Courses, struct {
				ID          uint   `json:"id"`
				Title       string `json:"title"`
				Description string `json:"description"`
				SortOrder   int    `json:"sort_order"`
			}{
				ID:          course.ID,
				Title:       course.Title,
				Description: course.Description,
				SortOrder:   0, // 暂时设为0，如果需要可以后续优化
			})
		}
	}

	return response, nil, nil
}

// ListLessonsParams 列出课时请求参数
type ListLessonsParams struct {
	CourseID uint `json:"course_id" form:"courseId"` // 可选，不提供时列出所有课件
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
}

func (p *ListLessonsParams) Parse(c *gin.Context) gorails.Error {
	// 设置默认值
	p.PageSize = 20
	p.BeginID = 0
	p.Forward = true
	p.Asc = true
	p.CourseID = 0 // 默认为0，表示列出所有课件

	// 解析可选的课程ID
	if courseIDStr := c.DefaultQuery("courseId", ""); courseIDStr != "" {
		if courseID, err := strconv.ParseUint(courseIDStr, 10, 32); err == nil {
			p.CourseID = uint(courseID)
		}
	}

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

// ListLessonsHandler 列出课时
func (h *Handler) ListLessonsHandler(c *gin.Context, params *ListLessonsParams) ([]model.Lesson, *gorails.ResponseMeta, gorails.Error) {
	// 获取课时列表
	lessons, hasMore, err := h.dao.LessonDao.ListLessonsWithPagination(params.CourseID, params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 获取总数
	total, _ := h.dao.LessonDao.CountLessonsByCourse(params.CourseID)

	return lessons, &gorails.ResponseMeta{
		Total:   int(total),
		HasNext: hasMore,
	}, nil
}

// DeleteLessonParams 删除课时请求参数
type DeleteLessonParams struct {
	LessonID  uint  `json:"lesson_id" uri:"lesson_id" binding:"required"`
	UpdatedAt int64 `json:"updated_at"` // 乐观锁
}

func (p *DeleteLessonParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 手动验证必需的字段
	if p.UpdatedAt == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, "updated_at字段为必填项", nil)
	}

	return nil
}

// DeleteLessonResponse 删除课时响应
type DeleteLessonResponse struct {
	Message string `json:"message"`
}

// DeleteLessonHandler 删除课时
func (h *Handler) DeleteLessonHandler(c *gin.Context, params *DeleteLessonParams) (*DeleteLessonResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 获取课时信息进行权限检查
	_, err := h.dao.LessonDao.GetLesson(params.LessonID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
	}

	// 验证权限（通过课时关联的课程检查）
	courses, err := h.dao.LessonDao.GetLessonCourses(params.LessonID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 检查用户是否有权限删除该课时
	// 1. 如果课时没有关联任何课程，只有管理员可以删除
	// 2. 如果课时关联了课程，必须是其中任一关联课程的作者
	hasPermission := false

	if len(courses) == 0 {
		// 没有关联课程的课时，检查是否为管理员
		userInfo, err := h.dao.UserDao.GetUserByID(userID)
		if err != nil || userInfo.Role != "admin" {
			hasPermission = false
		} else {
			hasPermission = true
		}
	} else {
		// 有关联课程的课时，检查是否为任一课程的作者
		for _, course := range courses {
			if course.AuthorID == userID {
				hasPermission = true
				break
			}
		}
	}

	if !hasPermission {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, errors.New("无权限删除此课时"))
	}

	// 调用服务层删除课时
	if err := h.dao.LessonDao.DeleteLesson(params.LessonID, userID, params.UpdatedAt); err != nil {
		if err.Error() == "课时已被其他用户修改，请刷新后重试" {
			return nil, nil, gorails.NewError(http.StatusConflict, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeUpdateConflict, "课时已被其他用户修改，请刷新后重试", err)
		}
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeDeleteFailed, global.ErrorMsgDeleteFailed, err)
	}

	return &DeleteLessonResponse{
		Message: "课时删除成功",
	}, nil, nil
}

// ReorderLessonsParams 重新排序课时请求参数
type ReorderLessonsParams struct {
	CourseID uint              `uri:"course_id" binding:"required"`
	Lessons  []dao.LessonOrder `json:"lessons"`
}

func (p *ReorderLessonsParams) Parse(c *gin.Context) gorails.Error {
	// 先绑定URI参数
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, fmt.Sprintf("绑定URI参数失败: %v", err), err)
	}

	// 再绑定JSON body
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, fmt.Sprintf("绑定JSON参数失败: %v", err), err)
	}

	// 验证必需的字段
	if p.CourseID == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, "course_id字段为必填项", nil)
	}

	if len(p.Lessons) == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, "lessons字段为必填项", nil)
	}

	// 验证每个lesson的必需字段
	for i, lesson := range p.Lessons {
		if lesson.ID == 0 {
			return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, fmt.Sprintf("lessons[%d].id字段为必填项", i), nil)
		}
		if lesson.SortOrder == 0 {
			return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, fmt.Sprintf("lessons[%d].sort_order字段为必填项", i), nil)
		}
	}

	return nil
}

// ReorderLessonsResponse 重新排序课时响应
type ReorderLessonsResponse struct {
	Message string `json:"message"`
}

// ReorderLessonsHandler 重新排序课时
func (h *Handler) ReorderLessonsHandler(c *gin.Context, params *ReorderLessonsParams) (*ReorderLessonsResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 验证课程是否存在且用户有权限
	course, err := h.dao.CourseDao.GetCourse(params.CourseID)
	if err != nil || course.AuthorID != userID {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, errors.New("无权限操作此课程"))
	}

	// 调用服务层重排课时
	if err := h.dao.LessonDao.ReorderLessonsWithOrder(params.CourseID, params.Lessons); err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeUpdateFailed, global.ErrorMsgUpdateFailed, err)
	}

	response := &ReorderLessonsResponse{
		Message: "课时排序更新成功",
	}

	return response, nil, nil
}

// GetCourseLessonsParams 获取课程课时请求参数
type GetCourseLessonsParams struct {
	CourseID uint `json:"course_id" uri:"course_id" binding:"required"`
}

func (p *GetCourseLessonsParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetCourseLessonsHandler 获取课程课时
func (h *Handler) GetCourseLessonsHandler(c *gin.Context, params *GetCourseLessonsParams) ([]model.Lesson, *gorails.ResponseMeta, gorails.Error) {
	lessons, err := h.dao.LessonDao.ListLessonsByCourse(params.CourseID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}
	return lessons, nil, nil
}
