package handler

import (
	"errors"
	"net/http"
	"strconv"
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
	Message string `json:"message"`
	Data    struct {
		ID            uint   `json:"id"`
		Title         string `json:"title"`
		Description   string `json:"description"`
		AuthorID      uint   `json:"author_id"`
		Difficulty    string `json:"difficulty"`
		Duration      int    `json:"duration"`
		IsPublished   bool   `json:"is_published"`
		ThumbnailPath string `json:"thumbnail_path"`
		SortOrder     int    `json:"sort_order"`
		CreatedAt     string `json:"created_at"`
		UpdatedAt     string `json:"updated_at"`
	} `json:"data"`
}

// CreateCourseHandler 创建课程
func (h *Handler) CreateCourseHandler(c *gin.Context, params *CreateCourseParams) (*CreateCourseResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 调用服务层创建课程
	course, err := h.dao.CourseDao.CreateCourse(userID, params.Title, params.Description, params.Difficulty, params.Duration, params.IsPublished, params.ThumbnailPath)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeCreateFailed, global.ErrorMsgInsertFailed, err)
	}

	response := &CreateCourseResponse{
		Message: "课程创建成功",
	}
	response.Data.ID = course.ID
	response.Data.Title = course.Title
	response.Data.Description = course.Description
	response.Data.AuthorID = course.AuthorID
	response.Data.Difficulty = course.Difficulty
	response.Data.Duration = course.Duration
	response.Data.IsPublished = course.IsPublished
	response.Data.ThumbnailPath = course.ThumbnailPath
	response.Data.SortOrder = course.SortOrder
	response.Data.CreatedAt = course.CreatedAt.Format(time.RFC3339)
	response.Data.UpdatedAt = course.UpdatedAt.Format(time.RFC3339)

	return response, nil, nil
}

// UpdateCourseParams 更新课程请求参数
type UpdateCourseParams struct {
	CourseID    uint      `json:"course_id" uri:"course_id" binding:"required"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Content     string    `json:"content"`
	IsPublic    *bool     `json:"is_public"`
	UpdatedAt   time.Time `json:"updated_at" binding:"required"` // 乐观锁
}

func (p *UpdateCourseParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// UpdateCourseResponse 更新课程响应
type UpdateCourseResponse struct {
	Message string `json:"message"`
	Data    struct {
		ID          uint   `json:"id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		UpdatedAt   string `json:"updated_at"`
	} `json:"data"`
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
	if params.IsPublic != nil {
		updates["is_public"] = *params.IsPublic
	}

	// 调用服务层更新课程
	if err := h.dao.CourseDao.UpdateCourse(params.CourseID, userID, params.UpdatedAt, updates); err != nil {
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

	response := &UpdateCourseResponse{
		Message: "课程更新成功",
	}
	response.Data.ID = course.ID
	response.Data.Title = course.Title
	response.Data.Description = course.Description
	response.Data.UpdatedAt = course.UpdatedAt.Format(time.RFC3339)

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
	ID          uint   `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	AuthorID    uint   `json:"author_id"`
	Content     string `json:"content"`
	IsPublic    bool   `json:"is_public"`
	IsPublished bool   `json:"is_published"`
	SortOrder   int    `json:"sort_order"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
	Author      *struct {
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
	response.IsPublic = course.IsPublic
	response.IsPublished = course.IsPublished
	response.SortOrder = course.SortOrder
	response.CreatedAt = course.CreatedAt.Format(time.RFC3339)
	response.UpdatedAt = course.UpdatedAt.Format(time.RFC3339)

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
	CourseID  uint      `json:"course_id" uri:"course_id" binding:"required"`
	UpdatedAt time.Time `json:"updated_at" binding:"required"` // 乐观锁
}

func (p *DeleteCourseParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
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
	CourseID    uint      `json:"course_id" uri:"course_id" binding:"required"`
	IsPublished bool      `json:"is_published" binding:"required"`
	UpdatedAt   time.Time `json:"updated_at" binding:"required"` // 乐观锁
}

func (p *PublishCourseParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// PublishCourseResponse 发布课程响应
type PublishCourseResponse struct {
	Message string `json:"message"`
	Data    struct {
		ID          uint   `json:"id"`
		IsPublished bool   `json:"is_published"`
		UpdatedAt   string `json:"updated_at"`
	} `json:"data"`
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

	var action string
	if params.IsPublished {
		action = "发布"
	} else {
		action = "取消发布"
	}

	response := &PublishCourseResponse{
		Message: "课程" + action + "成功",
	}
	response.Data.ID = course.ID
	response.Data.IsPublished = course.IsPublished
	response.Data.UpdatedAt = course.UpdatedAt.Format(time.RFC3339)

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
	Message string `json:"message"`
	Data    struct {
		ID          uint   `json:"id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		AuthorID    uint   `json:"author_id"`
		LessonCount int    `json:"lesson_count"`
		CreatedAt   string `json:"created_at"`
	} `json:"data"`
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
		Message: "课程复制成功",
	}
	response.Data.ID = newCourse.ID
	response.Data.Title = newCourse.Title
	response.Data.Description = newCourse.Description
	response.Data.AuthorID = newCourse.AuthorID
	response.Data.CreatedAt = newCourse.CreatedAt.Format(time.RFC3339)

	if stats != nil {
		response.Data.LessonCount = int(stats.LessonCount)
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
