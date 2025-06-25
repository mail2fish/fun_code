package handler

import (
	"errors"
	"io"
	"log"
	"net/http"
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

// CreateCourseParams 创建课程请求参数
type CreateCourseParams struct {
	Title         string `json:"title" binding:"required"`
	Description   string `json:"description"`
	Difficulty    string `json:"difficulty" binding:"required"`
	Duration      int    `json:"duration" binding:"required"`
	IsPublished   bool   `json:"is_published"`
	ThumbnailPath string `json:"thumbnail_path"`
}

func (p *CreateCourseParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// CreateCourseResponse 创建课程响应
type CreateCourseResponse struct {
	ID          uint   `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	CreatedAt   int64  `json:"created_at"`
}

// CreateCourseHandler 创建课程
func (h *Handler) CreateCourseHandler(c *gin.Context, params *CreateCourseParams) (*CreateCourseResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 创建课程
	course, err := h.dao.CourseDao.CreateCourse(userID, params.Title, params.Description, params.Difficulty, params.Duration, params.IsPublished, params.ThumbnailPath)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeCreateFailed, global.ErrorMsgCreateFailed, err)
	}

	response := &CreateCourseResponse{
		ID:          course.ID,
		Title:       course.Title,
		Description: course.Description,
		CreatedAt:   course.CreatedAt,
	}

	return response, nil, nil
}

// UpdateCourseParams 更新课程请求参数
type UpdateCourseParams struct {
	CourseID      uint   `json:"course_id" uri:"course_id" binding:"required"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	Content       string `json:"content"`
	IsPublished   *bool  `json:"is_published"` // 使用指针以区分false和未设置
	Difficulty    string `json:"difficulty"`
	Duration      *int   `json:"duration"` // 使用指针以区分0和未设置
	ThumbnailPath string `json:"thumbnail_path"`
	UpdatedAt     int64  `json:"updated_at"` // 乐观锁，只在JSON中验证
}

func (p *UpdateCourseParams) Parse(c *gin.Context) gorails.Error {
	// 记录原始请求体用于调试
	if body, err := c.GetRawData(); err == nil {
		log.Printf("UpdateCourse Request Body: %s", string(body))
		// 重新设置请求体以便后续读取
		c.Request.Body = io.NopCloser(strings.NewReader(string(body)))
	}

	if err := c.ShouldBindUri(p); err != nil {
		log.Printf("URI binding error: %v", err)
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	if err := c.ShouldBindJSON(p); err != nil {
		log.Printf("JSON binding error: %v", err)
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 手动验证必需的字段
	if p.UpdatedAt == 0 {
		log.Printf("UpdatedAt validation failed: value is %d", p.UpdatedAt)
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, "updated_at字段为必填项", nil)
	}

	log.Printf("Parsed UpdateCourseParams: %+v", p)
	return nil
}

// UpdateCourseResponse 更新课程响应
type UpdateCourseResponse struct {
	ID          uint   `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	UpdatedAt   int64  `json:"updated_at"`
}

// UpdateCourseHandler 更新课程
func (h *Handler) UpdateCourseHandler(c *gin.Context, params *UpdateCourseParams) (*UpdateCourseResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 构建更新数据
	updates := make(map[string]interface{})
	if params.Title != "" {
		updates["title"] = params.Title
	}
	if params.Description != "" {
		updates["description"] = params.Description
	}
	if params.Content != "" {
		updates["content"] = params.Content
	}
	if params.IsPublished != nil {
		updates["is_published"] = *params.IsPublished
	}
	if params.Difficulty != "" {
		updates["difficulty"] = params.Difficulty
	}
	if params.Duration != nil {
		updates["duration"] = *params.Duration
	}
	if params.ThumbnailPath != "" {
		updates["thumbnail_path"] = params.ThumbnailPath
	}

	// 更新课程
	if err := h.dao.CourseDao.UpdateCourse(params.CourseID, userID, params.UpdatedAt, updates); err != nil {
		// 根据错误类型返回不同的错误码
		if strings.Contains(err.Error(), "已被其他用户修改") {
			return nil, nil, gorails.NewError(http.StatusConflict, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeUpdateConflict, global.ErrorMsgUpdateConflict, err)
		}
		if strings.Contains(err.Error(), "不存在或您无权") {
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeUpdateFailed, global.ErrorMsgUpdateFailed, err)
	}

	// 获取更新后的课程信息
	course, err := h.dao.CourseDao.GetCourse(params.CourseID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	response := &UpdateCourseResponse{
		ID:          course.ID,
		Title:       course.Title,
		Description: course.Description,
		UpdatedAt:   course.UpdatedAt,
	}

	return response, nil, nil
}

// GetCourseParams 获取课程详情请求参数
type GetCourseParams struct {
	CourseID       uint `json:"course_id" uri:"course_id" binding:"required"`
	IncludeLessons bool `json:"include_lessons" form:"include_lessons"`
}

func (p *GetCourseParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 解析查询参数
	if includeLessonsStr := c.DefaultQuery("include_lessons", "false"); includeLessonsStr != "" {
		p.IncludeLessons = includeLessonsStr == "true"
	}

	return nil
}

// GetCourseResponse 获取课程详情响应
type GetCourseResponse struct {
	ID            uint   `json:"id"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	AuthorID      uint   `json:"author_id"`
	Content       string `json:"content"`
	IsPublished   bool   `json:"is_published"`
	SortOrder     int    `json:"sort_order"`
	Duration      int    `json:"duration"`
	Difficulty    string `json:"difficulty"`
	ThumbnailPath string `json:"thumbnail_path"`
	CreatedAt     int64  `json:"created_at"`
	UpdatedAt     int64  `json:"updated_at"`
	Author        *struct {
		ID       uint   `json:"id"`
		Username string `json:"username"`
		Email    string `json:"email"`
	} `json:"author,omitempty"`
	Lessons     []model.Lesson   `json:"lessons,omitempty"`
	LessonCount int              `json:"lesson_count"`
	Stats       *dao.CourseStats `json:"stats,omitempty"`
}

// GetCourseHandler 获取课程详情
func (h *Handler) GetCourseHandler(c *gin.Context, params *GetCourseParams) (*GetCourseResponse, *gorails.ResponseMeta, gorails.Error) {
	var course *model.Course
	var err error

	// 根据参数决定是否包含课时列表
	if params.IncludeLessons {
		course, err = h.dao.CourseDao.GetCourseWithLessons(params.CourseID)
	} else {
		course, err = h.dao.CourseDao.GetCourse(params.CourseID)
	}

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || err.Error() == "课程不存在" {
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	response := &GetCourseResponse{}
	response.ID = course.ID
	response.Title = course.Title
	response.Description = course.Description
	response.AuthorID = course.AuthorID
	response.Content = course.Content
	response.IsPublished = course.IsPublished
	response.SortOrder = course.SortOrder
	response.Duration = course.Duration
	response.Difficulty = course.Difficulty
	response.ThumbnailPath = course.ThumbnailPath
	response.CreatedAt = course.CreatedAt
	response.UpdatedAt = course.UpdatedAt

	// 作者信息
	if course.Author.ID != 0 {
		response.Author = &struct {
			ID       uint   `json:"id"`
			Username string `json:"username"`
			Email    string `json:"email"`
		}{
			ID:       course.Author.ID,
			Username: course.Author.Username,
			Email:    course.Author.Email,
		}
	}

	// 课时信息
	if params.IncludeLessons && len(course.Lessons) > 0 {
		response.Lessons = course.Lessons
	}
	response.LessonCount = len(course.Lessons)

	// 获取统计信息
	if stats, err := h.dao.CourseDao.GetCourseStats(params.CourseID); err == nil {
		response.Stats = stats
	}

	return response, nil, nil
}

// ListCoursesParams 列出课程请求参数
type ListCoursesParams struct {
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
}

func (p *ListCoursesParams) Parse(c *gin.Context) gorails.Error {
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

// ListCoursesResponse 列出课程响应
type ListCoursesResponse struct {
	Data []model.Course `json:"data"`
}

// ListCoursesHandler 列出课程
func (h *Handler) ListCoursesHandler(c *gin.Context, params *ListCoursesParams) (*ListCoursesResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 获取课程列表
	courses, hasMore, err := h.dao.CourseDao.ListCoursesWithPagination(userID, params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 获取总数
	total, _ := h.dao.CourseDao.CountCoursesByAuthor(userID)

	return &ListCoursesResponse{
			Data: courses,
		}, &gorails.ResponseMeta{
			Total:   int(total),
			HasNext: hasMore,
		}, nil
}

// DeleteCourseParams 删除课程请求参数
type DeleteCourseParams struct {
	CourseID  uint  `json:"course_id" uri:"course_id" binding:"required"`
	UpdatedAt int64 `json:"updated_at"` // 乐观锁
}

func (p *DeleteCourseParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 手动验证必需的字段
	if p.UpdatedAt == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, "updated_at字段为必填项", nil)
	}

	return nil
}

// DeleteCourseResponse 删除课程响应
type DeleteCourseResponse struct {
	Message string `json:"message"`
}

// DeleteCourseHandler 删除课程
func (h *Handler) DeleteCourseHandler(c *gin.Context, params *DeleteCourseParams) (*DeleteCourseResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 调用服务层删除课程
	if err := h.dao.CourseDao.DeleteCourse(params.CourseID, userID, params.UpdatedAt); err != nil {
		if err.Error() == "课程已被其他用户修改，请刷新后重试" {
			return nil, nil, gorails.NewError(http.StatusConflict, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeUpdateConflict, "课程已被其他用户修改，请刷新后重试", err)
		}
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeDeleteFailed, global.ErrorMsgDeleteFailed, err)
	}

	return &DeleteCourseResponse{
		Message: "课程删除成功",
	}, nil, nil
}

// PublishCourseParams 发布课程请求参数
type PublishCourseParams struct {
	CourseID    uint  `json:"course_id" uri:"course_id" binding:"required"`
	IsPublished bool  `json:"is_published"`
	UpdatedAt   int64 `json:"updated_at"` // 乐观锁
}

func (p *PublishCourseParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 手动验证必需的字段
	if p.UpdatedAt == 0 {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, "updated_at字段为必填项", nil)
	}

	return nil
}

// PublishCourseResponse 发布课程响应
type PublishCourseResponse struct {
	ID          uint  `json:"id"`
	IsPublished bool  `json:"is_published"`
	UpdatedAt   int64 `json:"updated_at"`
}

// PublishCourseHandler 发布/取消发布课程
func (h *Handler) PublishCourseHandler(c *gin.Context, params *PublishCourseParams) (*PublishCourseResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 调用服务层发布课程
	if err := h.dao.CourseDao.PublishCourse(params.CourseID, userID, params.UpdatedAt, params.IsPublished); err != nil {
		if err.Error() == "课程已被其他用户修改，请刷新后重试" {
			return nil, nil, gorails.NewError(http.StatusConflict, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeUpdateConflict, "课程已被其他用户修改，请刷新后重试", err)
		}
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeUpdateFailed, global.ErrorMsgUpdateFailed, err)
	}

	// 获取更新后的课程信息
	course, err := h.dao.CourseDao.GetCourse(params.CourseID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	response := &PublishCourseResponse{
		ID:          course.ID,
		IsPublished: course.IsPublished,
		UpdatedAt:   course.UpdatedAt,
	}

	return response, nil, nil
}

// CopyCourseParams 复制课程请求参数
type CopyCourseParams struct {
	CourseID uint `json:"course_id" uri:"course_id" binding:"required"`
}

func (p *CopyCourseParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// CopyCourseResponse 复制课程响应
type CopyCourseResponse struct {
	ID          uint   `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	AuthorID    uint   `json:"author_id"`
	LessonCount int    `json:"lesson_count"`
	CreatedAt   string `json:"created_at"`
}

// CopyCourseHandler 复制课程
func (h *Handler) CopyCourseHandler(c *gin.Context, params *CopyCourseParams) (*CopyCourseResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 调用服务层复制课程
	newCourse, err := h.dao.CourseDao.DuplicateCourse(params.CourseID, userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeCreateFailed, global.ErrorMsgInsertFailed, err)
	}

	// 获取新课程的统计信息
	stats, _ := h.dao.CourseDao.GetCourseStats(newCourse.ID)

	response := &CopyCourseResponse{
		ID:          newCourse.ID,
		Title:       newCourse.Title,
		Description: newCourse.Description,
		AuthorID:    newCourse.AuthorID,
		CreatedAt:   time.Unix(newCourse.CreatedAt, 0).Format(time.RFC3339),
	}

	if stats != nil {
		response.LessonCount = int(stats.LessonCount)
	}

	return response, nil, nil
}

// ReorderCoursesParams 重新排序课程请求参数
type ReorderCoursesParams struct {
	CourseIDs []uint `json:"course_ids" binding:"required"`
}

func (p *ReorderCoursesParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// ReorderCoursesResponse 重新排序课程响应
type ReorderCoursesResponse struct {
	Message string `json:"message"`
}

// ReorderCoursesHandler 重新排序课程
func (h *Handler) ReorderCoursesHandler(c *gin.Context, params *ReorderCoursesParams) (*ReorderCoursesResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 调用服务层重新排序课程
	if err := h.dao.CourseDao.ReorderCourses(userID, params.CourseIDs); err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeUpdateFailed, global.ErrorMsgUpdateFailed, err)
	}

	return &ReorderCoursesResponse{
		Message: "课程排序成功",
	}, nil, nil
}
