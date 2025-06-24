package dao

import (
	"errors"
	"fmt"
	"time"

	"github.com/jun/fun_code/internal/model"
	"gorm.io/gorm"
)

// CourseDaoImpl 课程服务实现
type CourseDaoImpl struct {
	db *gorm.DB
}

// NewCourseDao 创建课程服务实例
func NewCourseDao(db *gorm.DB) CourseDao {
	return &CourseDaoImpl{db: db}
}

// CreateCourse 创建课程
func (c *CourseDaoImpl) CreateCourse(authorID uint, title, description, difficulty string, duration int, isPublished bool, thumbnailPath string) (*model.Course, error) {
	if title == "" {
		return nil, errors.New("课程标题不能为空")
	}

	// 获取当前作者的最大排序号
	var maxSort int
	c.db.Model(&model.Course{}).Where("author_id = ?", authorID).Select("COALESCE(MAX(sort_order), 0)").Scan(&maxSort)

	course := model.Course{
		Title:         title,
		Description:   description,
		AuthorID:      authorID,
		Difficulty:    difficulty,
		Duration:      duration,
		IsPublished:   isPublished,
		ThumbnailPath: thumbnailPath,
		IsPublic:      false, // 默认不公开
		SortOrder:     maxSort + 1,
	}

	if err := c.db.Create(&course).Error; err != nil {
		return nil, fmt.Errorf("创建课程失败: %w", err)
	}

	return &course, nil
}

// UpdateCourse 更新课程信息（乐观锁）
func (c *CourseDaoImpl) UpdateCourse(courseID, authorID uint, expectedUpdatedAt time.Time, updates map[string]interface{}) error {
	// 检查课程是否存在且属于该作者
	var course model.Course
	if err := c.db.Where("id = ? AND author_id = ?", courseID, authorID).First(&course).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课程不存在或您无权修改")
		}
		return err
	}

	// 乐观锁：检查updated_at是否匹配
	result := c.db.Model(&course).
		Where("id = ? AND updated_at = ?", courseID, expectedUpdatedAt).
		Updates(updates)

	if result.Error != nil {
		return fmt.Errorf("更新课程失败: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return errors.New("课程已被其他用户修改，请刷新后重试")
	}

	return nil
}

// GetCourse 获取课程详情
func (c *CourseDaoImpl) GetCourse(courseID uint) (*model.Course, error) {
	var course model.Course
	if err := c.db.Preload("Author").First(&course, courseID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("课程不存在")
		}
		return nil, err
	}

	return &course, nil
}

// GetCourseWithLessons 获取课程详情（包含课时列表）
func (c *CourseDaoImpl) GetCourseWithLessons(courseID uint) (*model.Course, error) {
	var course model.Course
	if err := c.db.Preload("Author").
		Preload("Lessons", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC, id ASC")
		}).
		First(&course, courseID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("课程不存在")
		}
		return nil, err
	}

	return &course, nil
}

// ListCourses 列出作者创建的所有课程
func (c *CourseDaoImpl) ListCourses(authorID uint) ([]model.Course, error) {
	var courses []model.Course
	if err := c.db.Where("author_id = ?", authorID).
		Order("sort_order ASC, id ASC").
		Find(&courses).Error; err != nil {
		return nil, err
	}

	return courses, nil
}

// DeleteCourse 删除课程（乐观锁）
func (c *CourseDaoImpl) DeleteCourse(courseID, authorID uint, expectedUpdatedAt time.Time) error {
	// 检查课程是否存在且属于该作者
	var course model.Course
	if err := c.db.Where("id = ? AND author_id = ?", courseID, authorID).First(&course).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课程不存在或您无权删除")
		}
		return err
	}

	// 使用事务确保数据一致性
	return c.db.Transaction(func(tx *gorm.DB) error {
		// 乐观锁：检查updated_at是否匹配
		result := tx.Where("id = ? AND updated_at = ?", courseID, expectedUpdatedAt).
			Delete(&course)

		if result.Error != nil {
			return fmt.Errorf("删除课程失败: %w", result.Error)
		}

		if result.RowsAffected == 0 {
			return errors.New("课程已被其他用户修改，请刷新后重试")
		}

		// 删除课程下的所有课时
		if err := tx.Where("course_id = ?", courseID).Delete(&model.Lesson{}).Error; err != nil {
			return fmt.Errorf("删除课时失败: %w", err)
		}

		// 删除课程与班级的关联
		if err := tx.Where("course_id = ?", courseID).Delete(&model.ClassCourse{}).Error; err != nil {
			return fmt.Errorf("删除班级关联失败: %w", err)
		}

		return nil
	})
}

// ListCoursesWithPagination 分页获取课程列表
func (c *CourseDaoImpl) ListCoursesWithPagination(authorID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Course, bool, error) {
	var courses []model.Course

	// 构建查询
	query := c.db.Where("author_id = ?", authorID)

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

	if err := query.Find(&courses).Error; err != nil {
		return nil, false, err
	}

	// 判断是否有更多数据
	hasMore := len(courses) > int(pageSize)
	if hasMore {
		courses = courses[:pageSize]
	}

	return courses, hasMore, nil
}

// PublishCourse 发布/取消发布课程（乐观锁）
func (c *CourseDaoImpl) PublishCourse(courseID, authorID uint, expectedUpdatedAt time.Time, isPublished bool) error {
	// 检查权限
	var course model.Course
	if err := c.db.Where("id = ? AND author_id = ?", courseID, authorID).First(&course).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课程不存在或您无权操作")
		}
		return err
	}

	// 乐观锁：检查updated_at是否匹配
	result := c.db.Model(&course).
		Where("id = ? AND updated_at = ?", courseID, expectedUpdatedAt).
		Update("is_published", isPublished)

	if result.Error != nil {
		return fmt.Errorf("更新发布状态失败: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return errors.New("课程已被其他用户修改，请刷新后重试")
	}

	return nil
}

// ReorderCourses 重新排序课程
func (c *CourseDaoImpl) ReorderCourses(authorID uint, courseIDs []uint) error {
	return c.db.Transaction(func(tx *gorm.DB) error {
		for i, courseID := range courseIDs {
			// 确保课程属于该作者
			if err := tx.Model(&model.Course{}).
				Where("id = ? AND author_id = ?", courseID, authorID).
				Update("sort_order", i+1).Error; err != nil {
				return fmt.Errorf("重排序课程 %d 失败: %w", courseID, err)
			}
		}
		return nil
	})
}

// CountCoursesByAuthor 统计作者的课程数量
func (c *CourseDaoImpl) CountCoursesByAuthor(authorID uint) (int64, error) {
	var count int64
	if err := c.db.Model(&model.Course{}).Where("author_id = ?", authorID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// GetCourseStats 获取课程统计信息
func (c *CourseDaoImpl) GetCourseStats(courseID uint) (*CourseStats, error) {
	stats := &CourseStats{}

	// 统计课时数量
	if err := c.db.Model(&model.Lesson{}).Where("course_id = ?", courseID).Count(&stats.LessonCount).Error; err != nil {
		return nil, err
	}

	// 统计已发布课时数量
	if err := c.db.Model(&model.Lesson{}).
		Where("course_id = ? AND is_published = ?", courseID, true).
		Count(&stats.PublishedLessons).Error; err != nil {
		return nil, err
	}

	// 统计总时长
	var totalDuration int
	c.db.Model(&model.Lesson{}).
		Where("course_id = ?", courseID).
		Select("COALESCE(SUM(duration), 0)").
		Scan(&totalDuration)
	stats.TotalDuration = totalDuration

	// 统计关联班级数量
	if err := c.db.Model(&model.ClassCourse{}).Where("course_id = ?", courseID).Count(&stats.ClassCount).Error; err != nil {
		return nil, err
	}

	// 统计学习学生数量（通过班级关联）
	if err := c.db.Table("class_users").
		Joins("JOIN class_courses ON class_users.class_id = class_courses.class_id").
		Where("class_courses.course_id = ? AND class_users.is_active = ?", courseID, true).
		Distinct("class_users.user_id").
		Count(&stats.StudentCount).Error; err != nil {
		return nil, err
	}

	return stats, nil
}

// AddLessonToCourse 添加课时到课程
func (c *CourseDaoImpl) AddLessonToCourse(courseID, authorID uint, lesson *model.Lesson) error {
	// 检查课程权限
	var course model.Course
	if err := c.db.Where("id = ? AND author_id = ?", courseID, authorID).First(&course).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课程不存在或您无权操作")
		}
		return err
	}

	// 设置课程ID
	lesson.CourseID = courseID

	// 如果没有指定排序，则设置为最后一个
	if lesson.SortOrder == 0 {
		var maxSort int
		c.db.Model(&model.Lesson{}).Where("course_id = ?", courseID).Select("COALESCE(MAX(sort_order), 0)").Scan(&maxSort)
		lesson.SortOrder = maxSort + 1
	}

	if err := c.db.Create(lesson).Error; err != nil {
		return fmt.Errorf("添加课时失败: %w", err)
	}

	return nil
}

// RemoveLessonFromCourse 从课程移除课时（乐观锁）
func (c *CourseDaoImpl) RemoveLessonFromCourse(courseID, lessonID, authorID uint, expectedUpdatedAt time.Time) error {
	// 检查课程权限和课时是否属于该课程
	var lesson model.Lesson
	if err := c.db.Joins("JOIN courses ON courses.id = lessons.course_id").
		Where("lessons.id = ? AND lessons.course_id = ? AND courses.author_id = ?", lessonID, courseID, authorID).
		First(&lesson).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课时不存在或您无权操作")
		}
		return err
	}

	// 乐观锁删除课时
	result := c.db.Where("id = ? AND updated_at = ?", lessonID, expectedUpdatedAt).Delete(&lesson)

	if result.Error != nil {
		return fmt.Errorf("删除课时失败: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return errors.New("课时已被其他用户修改，请刷新后重试")
	}

	return nil
}

// BatchUpdateCourses 批量更新课程（乐观锁）
func (c *CourseDaoImpl) BatchUpdateCourses(courseUpdates map[uint]CourseUpdateData) error {
	if len(courseUpdates) == 0 {
		return errors.New("课程更新数据不能为空")
	}

	return c.db.Transaction(func(tx *gorm.DB) error {
		var failedCourses []uint

		for courseID, updateData := range courseUpdates {
			result := tx.Model(&model.Course{}).
				Where("id = ? AND updated_at = ?", courseID, updateData.ExpectedUpdatedAt).
				Updates(updateData.Updates)

			if result.Error != nil {
				return fmt.Errorf("更新课程 %d 失败: %w", courseID, result.Error)
			}

			if result.RowsAffected == 0 {
				failedCourses = append(failedCourses, courseID)
			}
		}

		if len(failedCourses) > 0 {
			return fmt.Errorf("以下课程已被其他用户修改，请刷新后重试: %v", failedCourses)
		}

		return nil
	})
}

// BatchPublishCourses 批量发布/取消发布课程
func (c *CourseDaoImpl) BatchPublishCourses(authorID uint, courseIDs []uint, isPublished bool) error {
	if len(courseIDs) == 0 {
		return errors.New("课程ID列表不能为空")
	}

	// 确保所有课程都属于该作者
	var count int64
	c.db.Model(&model.Course{}).
		Where("id IN ? AND author_id = ?", courseIDs, authorID).
		Count(&count)

	if count != int64(len(courseIDs)) {
		return errors.New("部分课程不存在或您无权操作")
	}

	// 批量更新
	if err := c.db.Model(&model.Course{}).
		Where("id IN ? AND author_id = ?", courseIDs, authorID).
		Update("is_published", isPublished).Error; err != nil {
		return fmt.Errorf("批量更新发布状态失败: %w", err)
	}

	return nil
}

// DuplicateCourse 复制课程
func (c *CourseDaoImpl) DuplicateCourse(courseID, authorID uint) (*model.Course, error) {
	// 获取原课程（包含课时）
	originalCourse, err := c.GetCourseWithLessons(courseID)
	if err != nil {
		return nil, err
	}

	// 检查权限（可以复制自己的课程或公开课程）
	if originalCourse.AuthorID != authorID && !originalCourse.IsPublic {
		return nil, errors.New("您无权复制此课程")
	}

	var newCourse *model.Course
	err = c.db.Transaction(func(tx *gorm.DB) error {
		// 创建新课程
		course := model.Course{
			Title:       originalCourse.Title + " (副本)",
			Description: originalCourse.Description,
			AuthorID:    authorID,
			Content:     originalCourse.Content,
			IsPublic:    false, // 复制的课程默认不公开
			IsPublished: false, // 复制的课程默认不发布
		}

		// 获取新的排序号
		var maxSort int
		tx.Model(&model.Course{}).Where("author_id = ?", authorID).Select("COALESCE(MAX(sort_order), 0)").Scan(&maxSort)
		course.SortOrder = maxSort + 1

		if err := tx.Create(&course).Error; err != nil {
			return fmt.Errorf("创建课程副本失败: %w", err)
		}

		// 赋值给外部变量
		newCourse = &course

		// 复制课时
		for i, originalLesson := range originalCourse.Lessons {
			newLesson := model.Lesson{
				Title:        originalLesson.Title,
				Content:      originalLesson.Content,
				CourseID:     course.ID,
				SortOrder:    i + 1,
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
				IsPublished:  false, // 复制的课时默认不发布
			}

			if err := tx.Create(&newLesson).Error; err != nil {
				return fmt.Errorf("复制课时失败: %w", err)
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return newCourse, nil
}

// SearchCourses 搜索课程
func (c *CourseDaoImpl) SearchCourses(keyword string, authorID uint) ([]model.Course, error) {
	var courses []model.Course
	query := c.db.Where("title LIKE ? OR description LIKE ?", "%"+keyword+"%", "%"+keyword+"%")

	if authorID > 0 {
		query = query.Where("author_id = ?", authorID)
	}

	if err := query.Preload("Author").
		Order("sort_order ASC, id ASC").
		Find(&courses).Error; err != nil {
		return nil, err
	}

	return courses, nil
}
