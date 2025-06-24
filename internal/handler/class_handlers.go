package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/jun/fun_code/internal/model"
	"github.com/mail2fish/gorails/gorails"
	"gorm.io/gorm"
)

// CreateClassParams 创建班级请求参数
type CreateClassParams struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	StartDate   string `json:"start_date" binding:"required"`
	EndDate     string `json:"end_date" binding:"required"`
}

func (p *CreateClassParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// CreateClassResponse 创建班级响应
type CreateClassResponse struct {
	Message string `json:"message"`
	Data    struct {
		ID          uint   `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Code        string `json:"code"`
		TeacherID   uint   `json:"teacher_id"`
		StartDate   string `json:"start_date"`
		EndDate     string `json:"end_date"`
		IsActive    bool   `json:"is_active"`
	} `json:"data"`
}

// CreateClassHandler 创建班级 gorails.Wrap 形式
func (h *Handler) CreateClassHandler(c *gin.Context, params *CreateClassParams) (*CreateClassResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 调用服务层创建班级
	class, err := h.dao.ClassDao.CreateClass(userID, params.Name, params.Description, params.StartDate, params.EndDate)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeCreateFailed, global.ErrorMsgInsertFailed, err)
	}

	response := &CreateClassResponse{
		Message: "班级创建成功",
	}
	response.Data.ID = class.ID
	response.Data.Name = class.Name
	response.Data.Description = class.Description
	response.Data.Code = class.Code
	response.Data.TeacherID = class.TeacherID
	response.Data.StartDate = class.StartDate.Format("2006-01-02")
	response.Data.EndDate = class.EndDate.Format("2006-01-02")
	response.Data.IsActive = class.IsActive

	return response, nil, nil
}

// ListClassesParams 列出班级请求参数
type ListClassesParams struct {
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
}

func (p *ListClassesParams) Parse(c *gin.Context) gorails.Error {
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

// ListClassesResponse 列出班级响应
type ListClassesResponse struct {
	Data    []model.Class `json:"data"`
	HasMore bool          `json:"hasMore"`
	Total   int64         `json:"total"`
}

// ListClassesHandler 列出班级 gorails.Wrap 形式
func (h *Handler) ListClassesHandler(c *gin.Context, params *ListClassesParams) (*ListClassesResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 获取班级列表
	classes, hasMore, err := h.dao.ClassDao.ListClassesWithPagination(userID, params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return &ListClassesResponse{
		Data:    classes,
		HasMore: hasMore,
		Total:   0, // 暂时使用0，可以后续添加计数方法
	}, nil, nil
}

// GetClassParams 获取班级信息请求参数
type GetClassParams struct {
	ClassID uint `json:"class_id" uri:"class_id" binding:"required"`
}

func (p *GetClassParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetClassResponse 获取班级信息响应
type GetClassResponse struct {
	Data struct {
		ID          uint   `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Code        string `json:"code"`
		TeacherID   uint   `json:"teacher_id"`
		StartDate   string `json:"start_date"`
		EndDate     string `json:"end_date"`
		IsActive    bool   `json:"is_active"`
		CreatedAt   string `json:"created_at"`
		UpdatedAt   string `json:"updated_at"`
		Teacher     *struct {
			ID       uint   `json:"id"`
			Username string `json:"username"`
			Email    string `json:"email"`
		} `json:"teacher,omitempty"`
		Students []struct {
			ID       uint   `json:"id"`
			Username string `json:"username"`
			Email    string `json:"email"`
		} `json:"students,omitempty"`
		StudentsCount int `json:"students_count"`
		Courses       []struct {
			ID          uint   `json:"id"`
			Title       string `json:"title"`
			Description string `json:"description"`
			AuthorID    uint   `json:"author_id"`
			IsPublic    bool   `json:"is_public"`
		} `json:"courses,omitempty"`
		CoursesCount int `json:"courses_count"`
	} `json:"data"`
}

// GetClassHandler 获取班级信息 gorails.Wrap 形式
func (h *Handler) GetClassHandler(c *gin.Context, params *GetClassParams) (*GetClassResponse, *gorails.ResponseMeta, gorails.Error) {
	// 调用服务层获取班级信息
	class, err := h.dao.ClassDao.GetClass(params.ClassID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || err.Error() == "班级不存在" {
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	response := &GetClassResponse{}
	response.Data.ID = class.ID
	response.Data.Name = class.Name
	response.Data.Description = class.Description
	response.Data.Code = class.Code
	response.Data.TeacherID = class.TeacherID
	response.Data.StartDate = class.StartDate.Format("2006-01-02")
	response.Data.EndDate = class.EndDate.Format("2006-01-02")
	response.Data.IsActive = class.IsActive
	response.Data.CreatedAt = class.CreatedAt.Format("2006-01-02 15:04:05")
	response.Data.UpdatedAt = class.UpdatedAt.Format("2006-01-02 15:04:05")

	// 如果预加载了教师信息，则添加到响应中
	if class.Teacher.ID > 0 {
		response.Data.Teacher = &struct {
			ID       uint   `json:"id"`
			Username string `json:"username"`
			Email    string `json:"email"`
		}{
			ID:       class.Teacher.ID,
			Username: class.Teacher.Username,
			Email:    class.Teacher.Email,
		}
	}

	// 如果预加载了学生信息，则添加到响应中
	if len(class.Students) > 0 {
		response.Data.Students = make([]struct {
			ID       uint   `json:"id"`
			Username string `json:"username"`
			Email    string `json:"email"`
		}, len(class.Students))
		for i, student := range class.Students {
			response.Data.Students[i] = struct {
				ID       uint   `json:"id"`
				Username string `json:"username"`
				Email    string `json:"email"`
			}{
				ID:       student.ID,
				Username: student.Username,
				Email:    student.Email,
			}
		}
		response.Data.StudentsCount = len(class.Students)
	} else {
		response.Data.StudentsCount = 0
	}

	// 如果预加载了课程信息，则添加到响应中
	if len(class.Courses) > 0 {
		response.Data.Courses = make([]struct {
			ID          uint   `json:"id"`
			Title       string `json:"title"`
			Description string `json:"description"`
			AuthorID    uint   `json:"author_id"`
			IsPublic    bool   `json:"is_public"`
		}, len(class.Courses))
		for i, course := range class.Courses {
			response.Data.Courses[i] = struct {
				ID          uint   `json:"id"`
				Title       string `json:"title"`
				Description string `json:"description"`
				AuthorID    uint   `json:"author_id"`
				IsPublic    bool   `json:"is_public"`
			}{
				ID:          course.ID,
				Title:       course.Title,
				Description: course.Description,
				AuthorID:    course.AuthorID,
				IsPublic:    course.IsPublic,
			}
		}
		response.Data.CoursesCount = len(class.Courses)
	} else {
		response.Data.CoursesCount = 0
	}

	return response, nil, nil
}

// UpdateClassParams 更新班级信息请求参数
type UpdateClassParams struct {
	ClassID     uint   `json:"class_id" uri:"class_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	StartDate   string `json:"start_date" binding:"required"`
	EndDate     string `json:"end_date" binding:"required"`
	IsActive    *bool  `json:"is_active"` // 使用指针以区分false和未设置
}

func (p *UpdateClassParams) Parse(c *gin.Context) gorails.Error {
	// 先解析路径参数
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	// 再解析JSON参数
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// UpdateClassResponse 更新班级信息响应
type UpdateClassResponse struct {
	Message string `json:"message"`
	Data    struct {
		ID          uint   `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Code        string `json:"code"`
		TeacherID   uint   `json:"teacher_id"`
		StartDate   string `json:"start_date"`
		EndDate     string `json:"end_date"`
		IsActive    bool   `json:"is_active"`
	} `json:"data"`
}

// UpdateClassHandler 更新班级信息 gorails.Wrap 形式
func (h *Handler) UpdateClassHandler(c *gin.Context, params *UpdateClassParams) (*UpdateClassResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 构建更新参数
	updates := map[string]interface{}{
		"name":        params.Name,
		"description": params.Description,
		"start_date":  params.StartDate,
		"end_date":    params.EndDate,
	}
	if params.IsActive != nil {
		updates["is_active"] = *params.IsActive
	}

	// 调用服务层更新班级
	err := h.dao.ClassDao.UpdateClass(params.ClassID, userID, updates)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeUpdateFailed, global.ErrorMsgUpdateFailed, err)
	}

	// 获取更新后的班级信息
	class, err := h.dao.ClassDao.GetClass(params.ClassID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	response := &UpdateClassResponse{
		Message: "班级更新成功",
	}
	response.Data.ID = class.ID
	response.Data.Name = class.Name
	response.Data.Description = class.Description
	response.Data.Code = class.Code
	response.Data.TeacherID = class.TeacherID
	response.Data.StartDate = class.StartDate.Format("2006-01-02")
	response.Data.EndDate = class.EndDate.Format("2006-01-02")
	response.Data.IsActive = class.IsActive

	return response, nil, nil
}

// DeleteClassParams 删除班级请求参数
type DeleteClassParams struct {
	ClassID uint `json:"class_id" uri:"class_id" binding:"required"`
}

func (p *DeleteClassParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// DeleteClassResponse 删除班级响应
type DeleteClassResponse struct {
	Message string `json:"message"`
}

// DeleteClassHandler 删除班级 gorails.Wrap 形式
func (h *Handler) DeleteClassHandler(c *gin.Context, params *DeleteClassParams) (*DeleteClassResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 调用服务层删除班级
	err := h.dao.ClassDao.DeleteClass(params.ClassID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || err.Error() == "班级不存在或您无权修改" {
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeDeleteFailed, global.ErrorMsgDeleteFailed, err)
	}

	return &DeleteClassResponse{Message: "班级删除成功"}, nil, nil
}

// AddCourseToClassParams 为班级添加课程请求参数
type AddCourseToClassParams struct {
	ClassID  uint `json:"class_id" uri:"class_id" binding:"required"`
	CourseID uint `json:"course_id" binding:"required"`
}

func (p *AddCourseToClassParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// AddCourseToClassResponse 为班级添加课程响应
type AddCourseToClassResponse struct {
	Message string `json:"message"`
}

// AddCourseToClassHandler 为班级添加课程
func (h *Handler) AddCourseToClassHandler(c *gin.Context, params *AddCourseToClassParams) (*AddCourseToClassResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 调用服务层为班级添加课程
	// 添加课程时使用班级的日期范围作为默认值
	class, err := h.dao.ClassDao.GetClass(params.ClassID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	startDateStr := class.StartDate.Format("2006-01-02")
	endDateStr := class.EndDate.Format("2006-01-02")

	if err := h.dao.ClassDao.AddCourse(params.ClassID, userID, params.CourseID, startDateStr, endDateStr); err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeUpdateFailed, global.ErrorMsgUpdateFailed, err)
	}

	return &AddCourseToClassResponse{
		Message: "课程添加到班级成功",
	}, nil, nil
}

// RemoveCourseFromClassParams 从班级移除课程请求参数
type RemoveCourseFromClassParams struct {
	ClassID  uint `json:"class_id" uri:"class_id" binding:"required"`
	CourseID uint `json:"course_id" uri:"course_id" binding:"required"`
}

func (p *RemoveCourseFromClassParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// RemoveCourseFromClassResponse 从班级移除课程响应
type RemoveCourseFromClassResponse struct {
	Message string `json:"message"`
}

// RemoveCourseFromClassHandler 从班级移除课程
func (h *Handler) RemoveCourseFromClassHandler(c *gin.Context, params *RemoveCourseFromClassParams) (*RemoveCourseFromClassResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 调用服务层从班级移除课程
	if err := h.dao.ClassDao.RemoveCourse(params.ClassID, userID, params.CourseID); err != nil {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeUpdateFailed, global.ErrorMsgUpdateFailed, err)
	}

	return &RemoveCourseFromClassResponse{
		Message: "课程从班级移除成功",
	}, nil, nil
}

// GetClassCoursesParams 获取班级课程列表请求参数
type GetClassCoursesParams struct {
	ClassID  uint `json:"class_id" uri:"class_id" binding:"required"`
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
}

func (p *GetClassCoursesParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 设置默认值
	p.PageSize = 20
	p.BeginID = 0
	p.Forward = true
	p.Asc = true

	// 解析查询参数
	if pageSizeStr := c.DefaultQuery("pageSize", "20"); pageSizeStr != "" {
		if pageSize, err := strconv.ParseUint(pageSizeStr, 10, 32); err == nil {
			if pageSize > 0 && pageSize <= 100 {
				p.PageSize = uint(pageSize)
			}
		}
	}

	if beginIDStr := c.DefaultQuery("beginID", "0"); beginIDStr != "" {
		if beginID, err := strconv.ParseUint(beginIDStr, 10, 32); err == nil {
			p.BeginID = uint(beginID)
		}
	}

	if forwardStr := c.DefaultQuery("forward", "true"); forwardStr != "" {
		p.Forward = forwardStr != "false"
	}

	if ascStr := c.DefaultQuery("asc", "true"); ascStr != "" {
		p.Asc = ascStr != "false"
	}

	return nil
}

// GetClassCoursesResponse 获取班级课程列表响应
type GetClassCoursesResponse struct {
	Data    []model.Course `json:"data"`
	HasMore bool           `json:"hasMore"`
	Total   int64          `json:"total"`
}

// GetClassCoursesHandler 获取班级课程列表
func (h *Handler) GetClassCoursesHandler(c *gin.Context, params *GetClassCoursesParams) (*GetClassCoursesResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 获取班级课程列表（使用现有的ListCourses方法）
	courses, err := h.dao.ClassDao.ListCourses(params.ClassID, userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 简化版本：返回所有课程，不分页
	return &GetClassCoursesResponse{
		Data:    courses,
		HasMore: false,
		Total:   int64(len(courses)),
	}, nil, nil
}

// GetClassLessonsParams 获取班级所有课时请求参数
type GetClassLessonsParams struct {
	ClassID  uint `json:"class_id" uri:"class_id" binding:"required"`
	CourseID uint `json:"course_id" form:"courseId"` // 可选，指定课程
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
}

func (p *GetClassLessonsParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 设置默认值
	p.PageSize = 20
	p.BeginID = 0
	p.Forward = true
	p.Asc = true

	// 解析查询参数
	if courseIDStr := c.DefaultQuery("courseId", "0"); courseIDStr != "" {
		if courseID, err := strconv.ParseUint(courseIDStr, 10, 32); err == nil {
			p.CourseID = uint(courseID)
		}
	}

	if pageSizeStr := c.DefaultQuery("pageSize", "20"); pageSizeStr != "" {
		if pageSize, err := strconv.ParseUint(pageSizeStr, 10, 32); err == nil {
			if pageSize > 0 && pageSize <= 100 {
				p.PageSize = uint(pageSize)
			}
		}
	}

	if beginIDStr := c.DefaultQuery("beginID", "0"); beginIDStr != "" {
		if beginID, err := strconv.ParseUint(beginIDStr, 10, 32); err == nil {
			p.BeginID = uint(beginID)
		}
	}

	if forwardStr := c.DefaultQuery("forward", "true"); forwardStr != "" {
		p.Forward = forwardStr != "false"
	}

	if ascStr := c.DefaultQuery("asc", "true"); ascStr != "" {
		p.Asc = ascStr != "false"
	}

	return nil
}

// GetClassLessonsResponse 获取班级所有课时响应
type GetClassLessonsResponse struct {
	Data    []model.Lesson `json:"data"`
	HasMore bool           `json:"hasMore"`
	Total   int64          `json:"total"`
}

// GetClassLessonsHandler 获取班级所有课时
func (h *Handler) GetClassLessonsHandler(c *gin.Context, params *GetClassLessonsParams) (*GetClassLessonsResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	if params.CourseID != 0 {
		// 获取指定课程的课时
		lessonsSlice, hasMore, err := h.dao.LessonDao.ListLessonsWithPagination(params.CourseID, params.PageSize, params.BeginID, params.Forward, params.Asc)
		if err != nil {
			return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
		}
		total, _ := h.dao.LessonDao.CountLessonsByCourse(params.CourseID)

		return &GetClassLessonsResponse{
			Data:    lessonsSlice,
			HasMore: hasMore,
			Total:   total,
		}, nil, nil
	} else {
		// 获取班级所有课程，然后获取所有课时
		courses, err := h.dao.ClassDao.ListCourses(params.ClassID, userID)
		if err != nil {
			return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
		}

		// 收集所有课程的课时
		allLessons := make([]model.Lesson, 0)
		for _, course := range courses {
			courseLessons, _, err := h.dao.LessonDao.ListLessonsWithPagination(course.ID, 1000, 0, true, true) // 简化：获取所有课时
			if err == nil {
				allLessons = append(allLessons, courseLessons...)
			}
		}

		return &GetClassLessonsResponse{
			Data:    allLessons,
			HasMore: false,
			Total:   int64(len(allLessons)),
		}, nil, nil
	}
}
