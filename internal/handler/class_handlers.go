package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
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
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50001, "无效的请求参数", err)
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
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50002, "创建班级失败", err)
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
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50003, "获取班级列表失败", err)
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
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50004, "无效的班级ID", err)
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
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50005, "班级不存在", err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50006, "获取班级信息失败", err)
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
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50007, "无效的班级ID", err)
	}
	// 再解析JSON参数
	if err := c.ShouldBindJSON(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50008, "无效的请求参数", err)
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
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50009, "班级不存在", err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50010, "更新班级失败", err)
	}

	// 获取更新后的班级信息
	class, err := h.dao.ClassDao.GetClass(params.ClassID)
	if err != nil {
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50011, "获取更新后的班级信息失败", err)
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
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50012, "无效的班级ID", err)
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
			return nil, nil, gorails.NewError(http.StatusNotFound, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50013, "班级不存在", err)
		}
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, gorails.ErrorModule(custom_error.USER), 50014, "删除班级失败", err)
	}

	return &DeleteClassResponse{Message: "班级删除成功"}, nil, nil
}
