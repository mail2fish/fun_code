package handler

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	StudentIDs  []uint `json:"student_ids"`
	CourseIDs   []uint `json:"course_ids"`
}

func (p *CreateClassParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// CreateClassResponse 创建班级响应
type CreateClassResponse struct {
	Message     string `json:"message"`
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Code        string `json:"code"`
	TeacherID   uint   `json:"teacher_id"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	IsActive    bool   `json:"is_active"`
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
		Message:     "班级创建成功",
		ID:          class.ID,
		Name:        class.Name,
		Description: class.Description,
		Code:        class.Code,
		TeacherID:   class.TeacherID,
		StartDate:   class.StartDate.Format("2006-01-02"),
		EndDate:     class.EndDate.Format("2006-01-02"),
		IsActive:    class.IsActive,
	}

	// 添加学生到班级
	if len(params.StudentIDs) > 0 {
		for _, studentID := range params.StudentIDs {
			err := h.dao.ClassDao.AddStudent(class.ID, userID, studentID, "student")
			if err != nil {
				// 记录错误但不影响班级创建成功
				// TODO: 可以考虑记录到日志中
				continue
			}
		}
	}

	// 添加课程到班级
	if len(params.CourseIDs) > 0 {
		for _, courseID := range params.CourseIDs {
			err := h.dao.ClassDao.AddCourse(class.ID, userID, courseID, params.StartDate, params.EndDate)
			if err != nil {
				// 记录错误但不影响班级创建成功
				// TODO: 可以考虑记录到日志中
				continue
			}
		}
	}

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

type ClassResponse struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Code        string `json:"code"`
	TeacherID   uint   `json:"teacher_id"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`

	CountOfStudents int `json:"count_of_students"`
	CountOfCourses  int `json:"count_of_courses"`
}

// ListClassesHandler 列出班级 gorails.Wrap 形式
func (h *Handler) ListClassesHandler(c *gin.Context, params *ListClassesParams) ([]ClassResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 获取班级列表
	classes, hasMore, err := h.dao.ClassDao.ListClassesWithPagination(userID, params.PageSize, params.BeginID, params.Forward, params.Asc)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}
	total, err := h.dao.ClassDao.CountClasses(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	responses := make([]ClassResponse, len(classes))
	for i, class := range classes {
		responses[i] = ClassResponse{
			ID:              class.ID,
			Name:            class.Name,
			Description:     class.Description,
			Code:            class.Code,
			TeacherID:       class.TeacherID,
			StartDate:       class.StartDate.Format("2006-01-02"),
			EndDate:         class.EndDate.Format("2006-01-02"),
			CountOfStudents: len(class.Students),
			CountOfCourses:  len(class.Courses),
		}
	}

	return responses, &gorails.ResponseMeta{
		HasNext: hasMore,
		Total:   int(total),
	}, nil
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
		Nickname string `json:"nickname"`
	} `json:"students,omitempty"`
	StudentsCount int `json:"students_count"`
	Courses       []struct {
		ID          uint   `json:"id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		AuthorID    uint   `json:"author_id"`
	} `json:"courses,omitempty"`
	CoursesCount int `json:"courses_count"`
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

	response := &GetClassResponse{
		ID:          class.ID,
		Name:        class.Name,
		Description: class.Description,
		Code:        class.Code,
		TeacherID:   class.TeacherID,
		StartDate:   class.StartDate.Format("2006-01-02"),
		EndDate:     class.EndDate.Format("2006-01-02"),
		IsActive:    class.IsActive,
		CreatedAt:   time.Unix(class.CreatedAt, 0).Format("2006-01-02 15:04:05"),
		UpdatedAt:   time.Unix(class.UpdatedAt, 0).Format("2006-01-02 15:04:05"),
	}

	// 如果预加载了教师信息，则添加到响应中
	if class.Teacher.ID > 0 {
		response.Teacher = &struct {
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
		response.Students = make([]struct {
			ID       uint   `json:"id"`
			Username string `json:"username"`
			Email    string `json:"email"`
			Nickname string `json:"nickname"`
		}, len(class.Students))
		for i, student := range class.Students {
			response.Students[i] = struct {
				ID       uint   `json:"id"`
				Username string `json:"username"`
				Email    string `json:"email"`
				Nickname string `json:"nickname"`
			}{
				ID:       student.ID,
				Username: student.Username,
				Email:    student.Email,
				Nickname: student.Nickname,
			}
		}
		response.StudentsCount = len(class.Students)
	} else {
		response.StudentsCount = 0
	}

	// 如果预加载了课程信息，则添加到响应中
	if len(class.Courses) > 0 {
		response.Courses = make([]struct {
			ID          uint   `json:"id"`
			Title       string `json:"title"`
			Description string `json:"description"`
			AuthorID    uint   `json:"author_id"`
		}, len(class.Courses))
		for i, course := range class.Courses {
			response.Courses[i] = struct {
				ID          uint   `json:"id"`
				Title       string `json:"title"`
				Description string `json:"description"`
				AuthorID    uint   `json:"author_id"`
			}{
				ID:          course.ID,
				Title:       course.Title,
				Description: course.Description,
				AuthorID:    course.AuthorID,
			}
		}
		response.CoursesCount = len(class.Courses)
	} else {
		response.CoursesCount = 0
	}

	return response, nil, nil
}

// UpdateClassParams 更新班级信息请求参数
type UpdateClassParams struct {
	ClassID     uint   `uri:"class_id" binding:"required"` // 只从URI绑定
	Name        string `json:"name"`                       // 只从JSON绑定，验证在JSON结构体中
	Description string `json:"description"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	IsActive    bool   `json:"is_active"`
	StudentIDs  []uint `json:"student_ids"`
	CourseIDs   []uint `json:"course_ids"`
}

func (p *UpdateClassParams) Parse(c *gin.Context) gorails.Error {
	// 先解析路径参数
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 获取原始JSON数据用于调试
	body, _ := c.GetRawData()

	// 重新设置body，因为GetRawData会消耗掉body
	c.Request.Body = io.NopCloser(strings.NewReader(string(body)))

	// 解析JSON参数到临时结构体（排除class_id）
	var jsonParams struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		StartDate   string `json:"start_date" binding:"required"`
		EndDate     string `json:"end_date" binding:"required"`
		IsActive    bool   `json:"is_active"`
		StudentIDs  []uint `json:"student_ids"`
		CourseIDs   []uint `json:"course_ids"`
	}
	if err := c.ShouldBindJSON(&jsonParams); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}

	// 将JSON参数复制到主结构体
	p.Name = jsonParams.Name
	p.Description = jsonParams.Description
	p.StartDate = jsonParams.StartDate
	p.EndDate = jsonParams.EndDate
	p.IsActive = jsonParams.IsActive
	p.StudentIDs = jsonParams.StudentIDs
	p.CourseIDs = jsonParams.CourseIDs

	return nil
}

// UpdateClassResponse 更新班级信息响应
type UpdateClassResponse struct {
	Message     string `json:"message"`
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Code        string `json:"code"`
	TeacherID   uint   `json:"teacher_id"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	IsActive    bool   `json:"is_active"`
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
	updates["is_active"] = params.IsActive

	// 调用服务层更新班级
	err := h.dao.ClassDao.UpdateClass(params.ClassID, userID, updates)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeUpdateFailed, global.ErrorMsgUpdateFailed, err)
	}

	// 更新班级学生关联（如果提供了学生ID列表）
	if len(params.StudentIDs) > 0 {
		// 获取当前班级的学生列表
		currentStudents, err := h.dao.ClassDao.ListStudents(params.ClassID, userID)
		if err == nil {
			// 创建当前学生ID的映射
			currentStudentIDs := make(map[uint]bool)
			for _, student := range currentStudents {
				currentStudentIDs[student.ID] = true
			}

			// 添加新学生
			for _, studentID := range params.StudentIDs {
				if !currentStudentIDs[studentID] {
					_ = h.dao.ClassDao.AddStudent(params.ClassID, userID, studentID, "student")
				}
			}

			// 创建新学生ID的映射，用于移除不再需要的学生
			newStudentIDs := make(map[uint]bool)
			for _, studentID := range params.StudentIDs {
				newStudentIDs[studentID] = true
			}

			// 移除不再需要的学生
			for _, student := range currentStudents {
				if !newStudentIDs[student.ID] {
					_ = h.dao.ClassDao.RemoveStudent(params.ClassID, userID, student.ID)
				}
			}
		}
	}

	// 更新班级课程关联（如果提供了课程ID列表）
	if len(params.CourseIDs) > 0 {
		// 获取当前班级的课程列表
		currentCourses, err := h.dao.ClassDao.ListCourses(params.ClassID, userID)
		if err == nil {
			// 创建当前课程ID的映射
			currentCourseIDs := make(map[uint]bool)
			for _, course := range currentCourses {
				currentCourseIDs[course.ID] = true
			}

			// 添加新课程
			for _, courseID := range params.CourseIDs {
				if !currentCourseIDs[courseID] {
					_ = h.dao.ClassDao.AddCourse(params.ClassID, userID, courseID, params.StartDate, params.EndDate)
				}
			}

			// 创建新课程ID的映射，用于移除不再需要的课程
			newCourseIDs := make(map[uint]bool)
			for _, courseID := range params.CourseIDs {
				newCourseIDs[courseID] = true
			}

			// 移除不再需要的课程
			for _, course := range currentCourses {
				if !newCourseIDs[course.ID] {
					_ = h.dao.ClassDao.RemoveCourse(params.ClassID, userID, course.ID)
				}
			}
		}
	}

	// 获取更新后的班级信息
	class, err := h.dao.ClassDao.GetClass(params.ClassID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	response := &UpdateClassResponse{
		Message:     "班级更新成功",
		ID:          class.ID,
		Name:        class.Name,
		Description: class.Description,
		Code:        class.Code,
		TeacherID:   class.TeacherID,
		StartDate:   class.StartDate.Format("2006-01-02"),
		EndDate:     class.EndDate.Format("2006-01-02"),
		IsActive:    class.IsActive,
	}

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

type GetClassStudentsParams struct {
	ClassID uint `json:"class_id" uri:"class_id" binding:"required"`
}

func (p *GetClassStudentsParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

func (h *Handler) GetClassStudentsHandler(c *gin.Context, params *GetClassStudentsParams) ([]UserResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	students, err := h.dao.ClassDao.ListStudents(params.ClassID, userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	userResponses := make([]UserResponse, len(students))
	for i, student := range students {
		userResponses[i] = UserResponse{
			ID:       student.ID,
			Username: student.Username,
			Email:    student.Email,
		}
	}

	return userResponses, nil, nil
}

// ===== 学生端API处理函数 =====

// GetMyClassesParams 获取我的班级列表请求参数
type GetMyClassesParams struct {
	PageSize uint `json:"page_size" form:"pageSize"`
	BeginID  uint `json:"begin_id" form:"beginID"`
	Forward  bool `json:"forward" form:"forward"`
	Asc      bool `json:"asc" form:"asc"`
}

func (p *GetMyClassesParams) Parse(c *gin.Context) gorails.Error {
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

// GetMyClassesHandler 获取我的班级列表（学生端）
func (h *Handler) GetMyClassesHandler(c *gin.Context, params *GetMyClassesParams) ([]model.Class, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 获取用户参与的班级列表
	classes, err := h.dao.ClassDao.GetUserClasses(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return classes, &gorails.ResponseMeta{
		HasNext: false,
		Total:   len(classes),
	}, nil
}

// GetMyClassParams 获取我的班级详情请求参数
type GetMyClassParams struct {
	ClassID uint `json:"class_id" uri:"class_id" binding:"required"`
}

func (p *GetMyClassParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetMyClassHandler 获取我的班级详情（学生端）
func (h *Handler) GetMyClassHandler(c *gin.Context, params *GetMyClassParams) (*GetClassResponse, *gorails.ResponseMeta, gorails.Error) {
	// 检查用户是否是班级成员
	if !h.isClassMember(c, params.ClassID) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, errors.New("您不是该班级的成员"))
	}

	// 获取班级信息
	class, err := h.dao.ClassDao.GetClass(params.ClassID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryNotFound, global.ErrorMsgQueryNotFound, err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 构建响应（复用GetClassResponse结构）
	response := &GetClassResponse{
		ID:          class.ID,
		Name:        class.Name,
		Description: class.Description,
		Code:        class.Code,
		TeacherID:   class.TeacherID,
		StartDate:   class.StartDate.Format("2006-01-02"),
		EndDate:     class.EndDate.Format("2006-01-02"),
		IsActive:    class.IsActive,
		CreatedAt:   time.Unix(class.CreatedAt, 0).Format("2006-01-02 15:04:05"),
		UpdatedAt:   time.Unix(class.UpdatedAt, 0).Format("2006-01-02 15:04:05"),
	}

	// 添加教师信息
	if class.Teacher.ID != 0 {
		response.Teacher = &struct {
			ID       uint   `json:"id"`
			Username string `json:"username"`
			Email    string `json:"email"`
		}{
			ID:       class.Teacher.ID,
			Username: class.Teacher.Username,
			Email:    class.Teacher.Email,
		}
	}

	// 添加学生信息
	if len(class.Students) > 0 {
		response.Students = make([]struct {
			ID       uint   `json:"id"`
			Username string `json:"username"`
			Email    string `json:"email"`
			Nickname string `json:"nickname"`
		}, len(class.Students))
		for i, student := range class.Students {
			response.Students[i] = struct {
				ID       uint   `json:"id"`
				Username string `json:"username"`
				Email    string `json:"email"`
				Nickname string `json:"nickname"`
			}{
				ID:       student.ID,
				Username: student.Username,
				Email:    student.Email,
				Nickname: student.Nickname,
			}
		}
		response.StudentsCount = len(class.Students)
	} else {
		response.StudentsCount = 0
	}

	// 添加课程信息
	if len(class.Courses) > 0 {
		response.Courses = make([]struct {
			ID          uint   `json:"id"`
			Title       string `json:"title"`
			Description string `json:"description"`
			AuthorID    uint   `json:"author_id"`
		}, len(class.Courses))
		for i, course := range class.Courses {
			response.Courses[i] = struct {
				ID          uint   `json:"id"`
				Title       string `json:"title"`
				Description string `json:"description"`
				AuthorID    uint   `json:"author_id"`
			}{
				ID:          course.ID,
				Title:       course.Title,
				Description: course.Description,
				AuthorID:    course.AuthorID,
			}
		}
		response.CoursesCount = len(class.Courses)
	} else {
		response.CoursesCount = 0
	}

	return response, nil, nil
}

// GetMyClassCoursesParams 获取我的班级课程列表请求参数
type GetMyClassCoursesParams struct {
	ClassID uint `json:"class_id" uri:"class_id" binding:"required"`
}

func (p *GetMyClassCoursesParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetMyClassCoursesHandler 获取我的班级课程列表（学生端）
func (h *Handler) GetMyClassCoursesHandler(c *gin.Context, params *GetMyClassCoursesParams) (*GetClassCoursesResponse, *gorails.ResponseMeta, gorails.Error) {
	// 检查用户是否是班级成员
	if !h.isClassMember(c, params.ClassID) {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, errors.New("您不是该班级的成员"))
	}

	// 获取班级课程列表（不需要权限检查，因为上面已经检查过了）
	courses, err := h.dao.ClassDao.ListCoursesByClass(params.ClassID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 复用GetClassCoursesResponse结构
	return &GetClassCoursesResponse{
		Data:    courses,
		HasMore: false,
		Total:   int64(len(courses)),
	}, nil, nil
}

// GetMyCourseLessonsParams 获取我的课程课时列表请求参数
type GetMyCourseLessonsParams struct {
	CourseID uint `json:"course_id" uri:"course_id" binding:"required"`
}

func (p *GetMyCourseLessonsParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetMyCourseLessonsHandler 获取我的课程课时列表（学生端）
func (h *Handler) GetMyCourseLessonsHandler(c *gin.Context, params *GetMyCourseLessonsParams) ([]model.Lesson, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 检查用户是否有权限访问该课程（通过班级成员身份）
	// 获取用户参与的班级
	userClasses, err := h.dao.ClassDao.GetUserClasses(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 检查课程是否在用户的任何一个班级中
	hasAccess := false
	for _, class := range userClasses {
		for _, course := range class.Courses {
			if course.ID == params.CourseID {
				hasAccess = true
				break
			}
		}
		if hasAccess {
			break
		}
	}

	if !hasAccess {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, errors.New("您无权访问该课程"))
	}

	// 获取课程的课时列表（只返回已发布的课时）
	lessons, err := h.dao.LessonDao.ListLessonsByCourse(params.CourseID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return lessons, nil, nil
}

// GetMyCourseParams 获取我的课程详情请求参数
type GetMyCourseParams struct {
	CourseID uint `json:"course_id" uri:"course_id" binding:"required"`
}

func (p *GetMyCourseParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetMyCourseHandler 获取我的课程详情（学生端）
func (h *Handler) GetMyCourseHandler(c *gin.Context, params *GetMyCourseParams) (*model.Course, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 检查用户是否有权限访问该课程（通过班级成员身份）
	// 获取用户参与的班级
	userClasses, err := h.dao.ClassDao.GetUserClasses(userID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	// 检查课程是否在用户的任何一个班级中
	hasAccess := false
	for _, class := range userClasses {
		for _, course := range class.Courses {
			if course.ID == params.CourseID {
				hasAccess = true
				break
			}
		}
		if hasAccess {
			break
		}
	}

	if !hasAccess {
		return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_CLASS, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, errors.New("您无权访问该课程"))
	}

	// 获取课程详情
	course, err := h.dao.CourseDao.GetCourse(params.CourseID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_COURSE, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	return course, nil, nil
}

// GetMyLessonParams 获取我的课件详情请求参数
type GetMyLessonParams struct {
	LessonID uint `json:"lesson_id" uri:"lesson_id" binding:"required"`
}

func (p *GetMyLessonParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// GetMyLessonResponse 获取我的课件详情响应
type GetMyLessonResponse struct {
	ID      uint   `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
	Courses []struct {
		ID          uint   `json:"id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		SortOrder   int    `json:"sort_order"`
	} `json:"courses,omitempty"`

	DocumentName    string         `json:"document_name"`
	DocumentPath    string         `json:"document_path"`
	FlowChartID     uint           `json:"flow_chart_id"`
	ProjectType     string         `json:"project_type"`
	ProjectID1      uint           `json:"project_id_1"`
	ProjectID2      uint           `json:"project_id_2"`
	VideoPath1      string         `json:"video_path_1"`
	VideoPath2      string         `json:"video_path_2"`
	VideoPath3      string         `json:"video_path_3"`
	Duration        int            `json:"duration"`
	Difficulty      string         `json:"difficulty"`
	Description     string         `json:"description"`
	CreatedAt       string         `json:"created_at"`
	UpdatedAt       string         `json:"updated_at"`
	ResourceFileIDs []uint         `json:"resource_file_ids"`
	ResourceFiles   []FileResponse `json:"resource_files"`
}

// GetMyLessonHandler 获取我的课件详情（学生端）
func (h *Handler) GetMyLessonHandler(c *gin.Context, params *GetMyLessonParams) (*GetMyLessonResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := h.getUserID(c)

	// 使用带权限检查的方法获取课件详情
	lesson, err := h.dao.LessonDao.GetLessonWithPermission(params.LessonID, userID)
	if err != nil {
		if err.Error() == "课时不存在或您无权访问" {
			return nil, nil, gorails.NewError(http.StatusForbidden, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeNoPermission, global.ErrorMsgNoPermission, err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_LESSON, global.ErrorCodeQueryFailed, global.ErrorMsgQueryFailed, err)
	}

	response := &GetMyLessonResponse{
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

	// 添加资源文件信息
	if len(lesson.Files) > 0 {
		ids := make([]uint, 0, len(lesson.Files))
		for _, file := range lesson.Files {
			ids = append(ids, file.ID)
		}
		response.ResourceFileIDs = ids
		response.ResourceFiles = BuildFileResponses(lesson.Files)
	}

	// 获取关联的课程信息（通过多对多关系）
	if len(lesson.Courses) > 0 {
		for _, course := range lesson.Courses {
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
