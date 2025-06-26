package dao

import (
	"errors"
	"fmt"
	"time"

	"github.com/jun/fun_code/internal/model"
	"gorm.io/gorm"
)

// LessonDaoImpl 课时服务实现
type LessonDaoImpl struct {
	db *gorm.DB
}

// NewLessonDao 创建课时服务实例
func NewLessonDao(db *gorm.DB) LessonDao {
	return &LessonDaoImpl{db: db}
}

// CreateLesson 创建课时
func (l *LessonDaoImpl) CreateLesson(lesson *model.Lesson) error {
	if lesson.Title == "" {
		return errors.New("课时标题不能为空")
	}

	// 检查课程是否存在
	var course model.Course
	if err := l.db.First(&course, lesson.CourseID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课程不存在")
		}
		return err
	}

	// 如果没有指定排序，则设置为最后一个
	if lesson.SortOrder == 0 {
		var maxSort int
		l.db.Model(&model.Lesson{}).Where("course_id = ?", lesson.CourseID).Select("COALESCE(MAX(sort_order), 0)").Scan(&maxSort)
		lesson.SortOrder = maxSort + 1
	}

	// 设置时间戳
	now := time.Now().Unix()
	lesson.CreatedAt = now
	lesson.UpdatedAt = now

	if err := l.db.Create(lesson).Error; err != nil {
		return fmt.Errorf("创建课时失败: %w", err)
	}

	return nil
}

// UpdateLesson 更新课时信息（乐观锁，基于updated_at避免并发更新）
func (l *LessonDaoImpl) UpdateLesson(lessonID, authorID uint, expectedUpdatedAt int64, updates map[string]interface{}) error {
	// 检查课时是否存在且用户有权限修改
	var lesson model.Lesson
	if err := l.db.Joins("JOIN courses ON courses.id = lessons.course_id").
		Where("lessons.id = ? AND courses.author_id = ?", lessonID, authorID).
		First(&lesson).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课时不存在或您无权修改")
		}
		return err
	}

	// 乐观锁：检查updated_at是否匹配
	if lesson.UpdatedAt != expectedUpdatedAt {
		return errors.New("课时已被其他用户修改，请刷新后重试")
	}

	// 设置更新时间
	updates["updated_at"] = time.Now().Unix()

	// 执行更新
	result := l.db.Model(&lesson).
		Where("id = ? AND updated_at = ?", lessonID, expectedUpdatedAt).
		Updates(updates)

	if result.Error != nil {
		return fmt.Errorf("更新课时失败: %w", result.Error)
	}

	// 检查是否真的更新了记录（如果updated_at不匹配，RowsAffected会是0）
	if result.RowsAffected == 0 {
		return errors.New("课时已被其他用户修改，请刷新后重试")
	}

	return nil
}

// GetLesson 获取课时详情
func (l *LessonDaoImpl) GetLesson(lessonID uint) (*model.Lesson, error) {
	var lesson model.Lesson
	if err := l.db.Preload("Course").First(&lesson, lessonID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("课时不存在")
		}
		return nil, err
	}

	return &lesson, nil
}

// GetLessonWithPermission 获取课时详情（权限验证）
func (l *LessonDaoImpl) GetLessonWithPermission(lessonID, userID uint) (*model.Lesson, error) {
	var lesson model.Lesson

	// 查询课时并检查权限（课程作者或班级成员）
	query := l.db.Preload("Course").
		Joins("JOIN courses ON courses.id = lessons.course_id").
		Where("lessons.id = ?", lessonID)

	// 检查是否为课程作者
	query = query.Where("courses.author_id = ? OR EXISTS (?)",
		userID,
		l.db.Select("1").Table("class_courses").
			Joins("JOIN class_users ON class_users.class_id = class_courses.class_id").
			Where("class_courses.course_id = courses.id AND class_users.user_id = ? AND class_users.is_active = ?", userID, true))

	if err := query.First(&lesson).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("课时不存在或您无权访问")
		}
		return nil, err
	}

	return &lesson, nil
}

// ListLessonsByCourse 获取课程下的所有课时（按排序）
func (l *LessonDaoImpl) ListLessonsByCourse(courseID uint) ([]model.Lesson, error) {
	var lessons []model.Lesson
	if err := l.db.Where("course_id = ?", courseID).
		Order("sort_order ASC, id ASC").
		Find(&lessons).Error; err != nil {
		return nil, err
	}

	return lessons, nil
}

// ListLessonsWithPagination 分页获取课时列表
func (l *LessonDaoImpl) ListLessonsWithPagination(courseID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Lesson, bool, error) {
	var lessons []model.Lesson

	query := l.db
	// 构建查询
	if courseID > 0 {
		query = query.Where("course_id = ?", courseID)
	}

	// 分页逻辑
	if beginID > 0 {
		if forward {
			if asc {
				query = query.Where("id > ?", beginID)
			} else {
				query = query.Where("id < ?", beginID)
			}
		} else {
			if asc {
				query = query.Where("id < ?", beginID)
			} else {
				query = query.Where("id > ?", beginID)
			}
		}
	}

	// 排序
	orderClause := "sort_order ASC, id ASC"
	if !asc {
		orderClause = "sort_order DESC, id DESC"
	}
	query = query.Order(orderClause)

	// 查询多一条以判断是否还有更多数据
	query = query.Limit(int(pageSize + 1))

	if err := query.Find(&lessons).Error; err != nil {
		return nil, false, err
	}

	// 判断是否有更多数据
	hasMore := len(lessons) > int(pageSize)
	if hasMore {
		lessons = lessons[:pageSize]
	}

	return lessons, hasMore, nil
}

// DeleteLesson 删除课时（乐观锁，基于updated_at避免并发删除）
func (l *LessonDaoImpl) DeleteLesson(lessonID, authorID uint, expectedUpdatedAt int64) error {
	// 检查课时是否存在且用户有权限删除
	var lesson model.Lesson
	if err := l.db.Joins("JOIN courses ON courses.id = lessons.course_id").
		Where("lessons.id = ? AND courses.author_id = ?", lessonID, authorID).
		First(&lesson).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课时不存在或您无权删除")
		}
		return err
	}

	// 乐观锁：检查updated_at是否匹配
	if lesson.UpdatedAt != expectedUpdatedAt {
		return errors.New("课时已被其他用户修改，请刷新后重试")
	}

	// 执行删除
	result := l.db.Where("id = ? AND updated_at = ?", lessonID, expectedUpdatedAt).
		Delete(&lesson)

	if result.Error != nil {
		return fmt.Errorf("删除课时失败: %w", result.Error)
	}

	// 检查是否真的删除了记录（如果updated_at不匹配，RowsAffected会是0）
	if result.RowsAffected == 0 {
		return errors.New("课时已被其他用户修改，请刷新后重试")
	}

	return nil
}

// ReorderLessons 重新排序课时
func (l *LessonDaoImpl) ReorderLessons(courseID uint, lessonIDs []uint) error {
	return l.db.Transaction(func(tx *gorm.DB) error {
		for i, lessonID := range lessonIDs {
			if err := tx.Model(&model.Lesson{}).
				Where("id = ? AND course_id = ?", lessonID, courseID).
				Update("sort_order", i+1).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// ReorderLessonsWithOrder 使用明确排序信息重新排序课时
func (l *LessonDaoImpl) ReorderLessonsWithOrder(courseID uint, lessons []LessonOrder) error {
	return l.db.Transaction(func(tx *gorm.DB) error {
		for _, lesson := range lessons {
			if err := tx.Model(&model.Lesson{}).
				Where("id = ? AND course_id = ?", lesson.ID, courseID).
				Update("sort_order", lesson.SortOrder).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// GetLessonsByProjectID 根据项目ID获取相关课时
func (l *LessonDaoImpl) GetLessonsByProjectID(projectID uint) ([]model.Lesson, error) {
	var lessons []model.Lesson
	if err := l.db.Where("project_id_1 = ? OR project_id_2 = ? OR project_id_3 = ?",
		projectID, projectID, projectID).
		Preload("Course").
		Find(&lessons).Error; err != nil {
		return nil, err
	}

	return lessons, nil
}

// CountLessonsByCourse 统计课程下的课时数量
func (l *LessonDaoImpl) CountLessonsByCourse(courseID uint) (int64, error) {
	var count int64
	if err := l.db.Model(&model.Lesson{}).Where("course_id = ?", courseID).Count(&count).Error; err != nil {
		return 0, err
	}

	return count, nil
}

// GetNextLesson 获取下一课时
func (l *LessonDaoImpl) GetNextLesson(courseID uint, currentSortOrder int) (*model.Lesson, error) {
	var lesson model.Lesson
	if err := l.db.Where("course_id = ? AND sort_order > ?", courseID, currentSortOrder).
		Order("sort_order ASC").
		First(&lesson).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // 没有下一课时
		}
		return nil, err
	}

	return &lesson, nil
}

// GetPreviousLesson 获取上一课时
func (l *LessonDaoImpl) GetPreviousLesson(courseID uint, currentSortOrder int) (*model.Lesson, error) {
	var lesson model.Lesson
	if err := l.db.Where("course_id = ? AND sort_order < ?", courseID, currentSortOrder).
		Order("sort_order DESC").
		First(&lesson).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // 没有上一课时
		}
		return nil, err
	}

	return &lesson, nil
}

// SearchLessons 搜索课时
func (l *LessonDaoImpl) SearchLessons(keyword string, courseID uint) ([]model.Lesson, error) {
	var lessons []model.Lesson
	query := l.db.Where("title LIKE ? OR content LIKE ?", "%"+keyword+"%", "%"+keyword+"%")

	if courseID > 0 {
		query = query.Where("course_id = ?", courseID)
	}

	if err := query.Preload("Course").
		Order("sort_order ASC").
		Find(&lessons).Error; err != nil {
		return nil, err
	}

	return lessons, nil
}

// BatchUpdateLessons 批量更新课时（乐观锁，基于updated_at避免并发更新）
func (l *LessonDaoImpl) BatchUpdateLessons(lessonUpdates map[uint]LessonUpdateData) error {
	if len(lessonUpdates) == 0 {
		return errors.New("课时更新数据不能为空")
	}

	// 使用事务来保证批量操作的原子性
	return l.db.Transaction(func(tx *gorm.DB) error {
		var failedLessons []uint

		for lessonID, updateData := range lessonUpdates {
			// 乐观锁：检查updated_at是否匹配
			result := tx.Model(&model.Lesson{}).
				Where("id = ? AND updated_at = ?", lessonID, updateData.ExpectedUpdatedAt).
				Updates(updateData.Updates)

			if result.Error != nil {
				return fmt.Errorf("更新课时 %d 失败: %w", lessonID, result.Error)
			}

			// 检查是否真的更新了记录（如果updated_at不匹配，RowsAffected会是0）
			if result.RowsAffected == 0 {
				failedLessons = append(failedLessons, lessonID)
			}
		}

		// 如果有课时更新失败（due to optimistic lock），返回错误
		if len(failedLessons) > 0 {
			return fmt.Errorf("以下课时已被其他用户修改，请刷新后重试: %v", failedLessons)
		}

		return nil
	})
}

// DuplicateLesson 复制课时
func (l *LessonDaoImpl) DuplicateLesson(lessonID, targetCourseID, authorID uint) (*model.Lesson, error) {
	// 获取原课时
	originalLesson, err := l.GetLesson(lessonID)
	if err != nil {
		return nil, err
	}

	// 检查目标课程权限
	var targetCourse model.Course
	if err := l.db.Where("id = ? AND author_id = ?", targetCourseID, authorID).
		First(&targetCourse).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("目标课程不存在或您无权操作")
		}
		return nil, err
	}

	// 创建新课时
	newLesson := model.Lesson{
		Title:        originalLesson.Title + " (副本)",
		Content:      originalLesson.Content,
		CourseID:     targetCourseID,
		DocumentName: originalLesson.DocumentName,
		DocumentPath: originalLesson.DocumentPath,
		FlowChartID:  originalLesson.FlowChartID,
		ProjectType:  originalLesson.ProjectType,
		ProjectID1:   originalLesson.ProjectID1,
		ProjectID2:   originalLesson.ProjectID2,
		ProjectID3:   originalLesson.ProjectID3,
		Video1:       originalLesson.Video1,
		Video2:       originalLesson.Video2,
		Video3:       originalLesson.Video3,
		Duration:     originalLesson.Duration,
		Difficulty:   originalLesson.Difficulty,
		Description:  originalLesson.Description,
	}

	if err := l.CreateLesson(&newLesson); err != nil {
		return nil, err
	}

	return &newLesson, nil
}
