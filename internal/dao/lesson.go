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

// CreateLesson 创建课时（不再直接关联课程）
func (l *LessonDaoImpl) CreateLesson(lesson *model.Lesson) error {
	if lesson.Title == "" {
		return errors.New("课时标题不能为空")
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
	// 检查课时是否存在
	var lesson model.Lesson
	if err := l.db.Where("id = ?", lessonID).First(&lesson).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课时不存在")
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
	if err := l.db.Preload("Courses.Author").First(&lesson, lessonID).Error; err != nil {
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
	query := l.db.Preload("Courses.Author").
		Joins("JOIN lesson_courses lc ON lc.lesson_id = lessons.id").
		Joins("JOIN courses c ON c.id = lc.course_id").
		Where("lessons.id = ?", lessonID)

	// 检查是否为课程作者或班级成员
	query = query.Where("c.author_id = ? OR EXISTS (?)",
		userID,
		l.db.Select("1").Table("class_courses cc").
			Joins("JOIN class_users cu ON cu.class_id = cc.class_id").
			Where("cc.course_id = c.id AND cu.user_id = ? AND cu.is_active = ?", userID, true))

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
	return l.ListLessonsInCourse(courseID)
}

// ListLessonsWithPagination 分页获取课时列表，优化无限滚动支持
func (l *LessonDaoImpl) ListLessonsWithPagination(courseID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Lesson, bool, error) {
	var lessons []model.Lesson

	query := l.db.Preload("Courses.Author") // 预加载关联的课程数据和课程作者

	// 如果指定了课程ID，则通过关联表查询
	if courseID > 0 {
		query = query.Joins("JOIN lesson_courses lc ON lc.lesson_id = lessons.id").
			Where("lc.course_id = ?", courseID)
	}

	// 无限滚动分页逻辑：始终向下滚动加载更多
	if beginID > 0 && forward {
		// 对于无限滚动，总是获取比当前ID更小的记录（降序排列时）
		query = query.Where("lessons.id < ?", beginID)
	} else if beginID > 0 && !forward {
		// 向上翻页（不常用）
		query = query.Where("lessons.id > ?", beginID)
	}

	// 简化排序逻辑：无限滚动主要使用降序
	var orderClause string
	if courseID > 0 {
		// 特定课程：按关联表排序
		orderClause = "lc.sort_order ASC, lessons.id ASC"
		if !asc {
			orderClause = "lc.sort_order DESC, lessons.id DESC"
		}
	} else {
		// 全部课时：无限滚动使用降序（最新的在前）
		orderClause = "lessons.id DESC"
		if asc {
			orderClause = "lessons.id ASC"
		}

		// 如果是向上翻页，临时反转排序
		if !forward && beginID > 0 {
			if asc {
				orderClause = "lessons.id DESC"
			} else {
				orderClause = "lessons.id ASC"
			}
		}
	}
	query = query.Order(orderClause)

	// 限制查询数量（多查一条用于判断是否还有更多数据）
	limit := int(pageSize + 1)
	query = query.Limit(limit)

	if err := query.Find(&lessons).Error; err != nil {
		return nil, false, err
	}

	// 判断是否有更多数据
	hasMore := len(lessons) > int(pageSize)
	if hasMore {
		lessons = lessons[:pageSize]
	}

	// 如果是向上翻页，需要反转结果顺序以保持正确的显示顺序
	if !forward && beginID > 0 && courseID == 0 {
		// 反转切片顺序
		for i, j := 0, len(lessons)-1; i < j; i, j = i+1, j-1 {
			lessons[i], lessons[j] = lessons[j], lessons[i]
		}
	}

	return lessons, hasMore, nil
}

// DeleteLesson 删除课时（乐观锁，基于updated_at避免并发删除）
func (l *LessonDaoImpl) DeleteLesson(lessonID, authorID uint, expectedUpdatedAt int64) error {
	// 检查课时是否存在
	var lesson model.Lesson
	if err := l.db.Where("id = ?", lessonID).First(&lesson).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课时不存在")
		}
		return err
	}

	// 乐观锁：检查updated_at是否匹配
	if lesson.UpdatedAt != expectedUpdatedAt {
		return errors.New("课时已被其他用户修改，请刷新后重试")
	}

	// 使用事务删除课时及其关联
	return l.db.Transaction(func(tx *gorm.DB) error {
		// 先删除所有关联记录
		if err := tx.Where("lesson_id = ?", lessonID).Delete(&model.LessonCourse{}).Error; err != nil {
			return fmt.Errorf("删除课时关联失败: %w", err)
		}

		// 再删除课时本身
		result := tx.Where("id = ? AND updated_at = ?", lessonID, expectedUpdatedAt).
			Delete(&lesson)

		if result.Error != nil {
			return fmt.Errorf("删除课时失败: %w", result.Error)
		}

		// 检查是否真的删除了记录（如果updated_at不匹配，RowsAffected会是0）
		if result.RowsAffected == 0 {
			return errors.New("课时已被其他用户修改，请刷新后重试")
		}

		return nil
	})
}

// ReorderLessons 重新排序课时（使用新的多对多关系）
func (l *LessonDaoImpl) ReorderLessons(courseID uint, lessonIDs []uint) error {
	return l.ReorderLessonsInCourse(courseID, lessonIDs)
}

// ReorderLessonsWithOrder 使用明确排序信息重新排序课时
func (l *LessonDaoImpl) ReorderLessonsWithOrder(courseID uint, lessons []LessonOrder) error {
	return l.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now().Unix()
		for _, lesson := range lessons {
			if err := tx.Model(&model.LessonCourse{}).
				Where("lesson_id = ? AND course_id = ?", lesson.ID, courseID).
				Updates(map[string]interface{}{
					"sort_order": lesson.SortOrder,
					"updated_at": now,
				}).Error; err != nil {
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
		Preload("Courses.Author").
		Find(&lessons).Error; err != nil {
		return nil, err
	}

	return lessons, nil
}

// CountLessonsByCourse 统计课程下的课时数量，如果courseID为0则统计所有课时
func (l *LessonDaoImpl) CountLessonsByCourse(courseID uint) (int64, error) {
	var count int64

	if courseID > 0 {
		// 统计特定课程下的课时数量
		if err := l.db.Model(&model.LessonCourse{}).Where("course_id = ?", courseID).Count(&count).Error; err != nil {
			return 0, err
		}
	} else {
		// 统计所有课时数量
		if err := l.db.Model(&model.Lesson{}).Count(&count).Error; err != nil {
			return 0, err
		}
	}

	return count, nil
}

// GetNextLesson 获取下一课时
func (l *LessonDaoImpl) GetNextLesson(courseID uint, currentSortOrder int) (*model.Lesson, error) {
	var lesson model.Lesson
	if err := l.db.Joins("JOIN lesson_courses lc ON lc.lesson_id = lessons.id").
		Where("lc.course_id = ? AND lc.sort_order > ?", courseID, currentSortOrder).
		Order("lc.sort_order ASC").
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
	if err := l.db.Joins("JOIN lesson_courses lc ON lc.lesson_id = lessons.id").
		Where("lc.course_id = ? AND lc.sort_order < ?", courseID, currentSortOrder).
		Order("lc.sort_order DESC").
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
	query := l.db.Where("lessons.title LIKE ? OR lessons.content LIKE ?", "%"+keyword+"%", "%"+keyword+"%")

	if courseID > 0 {
		query = query.Joins("JOIN lesson_courses lc ON lc.lesson_id = lessons.id").
			Where("lc.course_id = ?", courseID).
			Order("lc.sort_order ASC")
	} else {
		query = query.Order("lessons.id ASC")
	}

	if err := query.Preload("Courses.Author").
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

	// 将新课时添加到目标课程
	if err := l.AddLessonToCourse(newLesson.ID, targetCourseID, 0); err != nil {
		return nil, err
	}

	return &newLesson, nil
}

// AddLessonToCourse 将课时添加到课程中
func (l *LessonDaoImpl) AddLessonToCourse(lessonID, courseID uint, sortOrder int) error {
	// 检查课时是否存在
	var lesson model.Lesson
	if err := l.db.First(&lesson, lessonID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课时不存在")
		}
		return err
	}

	// 检查课程是否存在
	var course model.Course
	if err := l.db.First(&course, courseID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课程不存在")
		}
		return err
	}

	// 如果没有指定排序，则设置为最后一个
	if sortOrder == 0 {
		var maxSort int
		l.db.Model(&model.LessonCourse{}).Where("course_id = ?", courseID).Select("COALESCE(MAX(sort_order), 0)").Scan(&maxSort)
		sortOrder = maxSort + 1
	}

	// 创建关联记录
	now := time.Now().Unix()
	lessonCourse := model.LessonCourse{
		LessonID:  lessonID,
		CourseID:  courseID,
		SortOrder: sortOrder,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := l.db.Create(&lessonCourse).Error; err != nil {
		return fmt.Errorf("添加课时到课程失败: %w", err)
	}

	return nil
}

// RemoveLessonFromCourse 从课程中移除课时
func (l *LessonDaoImpl) RemoveLessonFromCourse(lessonID, courseID uint) error {
	result := l.db.Where("lesson_id = ? AND course_id = ?", lessonID, courseID).Delete(&model.LessonCourse{})
	if result.Error != nil {
		return fmt.Errorf("从课程中移除课时失败: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return errors.New("课时与课程的关联不存在")
	}

	return nil
}

// UpdateLessonInCourse 更新课时在特定课程中的信息（排序等）
func (l *LessonDaoImpl) UpdateLessonInCourse(lessonID, courseID uint, sortOrder int) error {
	now := time.Now().Unix()
	result := l.db.Model(&model.LessonCourse{}).
		Where("lesson_id = ? AND course_id = ?", lessonID, courseID).
		Updates(map[string]interface{}{
			"sort_order": sortOrder,
			"updated_at": now,
		})

	if result.Error != nil {
		return fmt.Errorf("更新课时在课程中的信息失败: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return errors.New("课时与课程的关联不存在")
	}

	return nil
}

// GetLessonCourses 获取课时关联的所有课程
func (l *LessonDaoImpl) GetLessonCourses(lessonID uint) ([]model.Course, error) {
	var courses []model.Course
	if err := l.db.Joins("JOIN lesson_courses ON lesson_courses.course_id = courses.id").
		Where("lesson_courses.lesson_id = ?", lessonID).
		Order("lesson_courses.sort_order ASC").
		Find(&courses).Error; err != nil {
		return nil, err
	}

	return courses, nil
}

// ListLessonsInCourse 获取课程中的所有课时（按关联表中的排序）
func (l *LessonDaoImpl) ListLessonsInCourse(courseID uint) ([]model.Lesson, error) {
	var lessons []model.Lesson
	if err := l.db.Joins("JOIN lesson_courses ON lesson_courses.lesson_id = lessons.id").
		Where("lesson_courses.course_id = ?", courseID).
		Order("lesson_courses.sort_order ASC, lessons.id ASC").
		Find(&lessons).Error; err != nil {
		return nil, err
	}

	return lessons, nil
}

// ReorderLessonsInCourse 重新排序课程中的课时
func (l *LessonDaoImpl) ReorderLessonsInCourse(courseID uint, lessonIDs []uint) error {
	return l.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now().Unix()
		for i, lessonID := range lessonIDs {
			if err := tx.Model(&model.LessonCourse{}).
				Where("lesson_id = ? AND course_id = ?", lessonID, courseID).
				Updates(map[string]interface{}{
					"sort_order": i + 1,
					"updated_at": now,
				}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// IsLessonInCourse 检查课时是否属于指定课程
func (l *LessonDaoImpl) IsLessonInCourse(lessonID, courseID uint) (bool, error) {
	var count int64
	err := l.db.Model(&model.LessonCourse{}).
		Where("lesson_id = ? AND course_id = ? AND deleted_at IS NULL", lessonID, courseID).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
