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

	now := time.Now().Unix()
	course := model.Course{
		Title:         title,
		Description:   description,
		AuthorID:      authorID,
		Difficulty:    difficulty,
		Duration:      duration,
		IsPublished:   isPublished,
		ThumbnailPath: thumbnailPath,
		SortOrder:     maxSort + 1,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := c.db.Create(&course).Error; err != nil {
		return nil, fmt.Errorf("创建课程失败: %w", err)
	}

	return &course, nil
}

// UpdateCourse 更新课程信息（乐观锁）
func (c *CourseDaoImpl) UpdateCourse(courseID, authorID uint, expectedUpdatedAt int64, updates map[string]interface{}) error {
	// 检查课程是否存在且属于该作者
	var course model.Course
	if err := c.db.Where("id = ? AND author_id = ?", courseID, authorID).First(&course).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课程不存在或您无权修改")
		}
		return err
	}

	// 调试：记录时间戳信息
	fmt.Printf("UpdateCourse Debug:\n")
	fmt.Printf("  Course ID: %d\n", courseID)
	fmt.Printf("  DB UpdatedAt: %d (%s)\n", course.UpdatedAt, time.Unix(course.UpdatedAt, 0).Format(time.RFC3339))
	fmt.Printf("  Expected UpdatedAt: %d (%s)\n", expectedUpdatedAt, time.Unix(expectedUpdatedAt, 0).Format(time.RFC3339))
	fmt.Printf("  Time Match: %v\n", course.UpdatedAt == expectedUpdatedAt)

	// 乐观锁：检查时间戳是否匹配
	if course.UpdatedAt != expectedUpdatedAt {
		fmt.Printf("  Optimistic lock failed: DB time=%d, Expected time=%d\n",
			course.UpdatedAt, expectedUpdatedAt)
		return errors.New("课程已被其他用户修改，请刷新后重试")
	}

	// 设置更新时间
	updates["updated_at"] = time.Now().Unix()

	// 执行更新，使用时间戳进行数据库级别的乐观锁检查
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
			return db.Joins("JOIN lesson_courses ON lesson_courses.lesson_id = lessons.id").
				Where("lesson_courses.course_id = ?", courseID).
				Order("lesson_courses.sort_order ASC, lessons.id ASC")
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
func (c *CourseDaoImpl) DeleteCourse(courseID, authorID uint, expectedUpdatedAt int64) error {
	// 检查课程是否存在且属于该作者
	var course model.Course
	if err := c.db.Where("id = ? AND author_id = ?", courseID, authorID).First(&course).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			fmt.Printf("DeleteCourse: course not found or permission denied - courseID: %d, authorID: %d\n", courseID, authorID)
			return errors.New("课程不存在或您无权删除")
		}
		fmt.Printf("DeleteCourse: database error when checking course - %v\n", err)
		return err
	}

	// 调试：记录时间戳信息
	fmt.Printf("DeleteCourse Debug:\n")
	fmt.Printf("  Course ID: %d\n", courseID)
	fmt.Printf("  Author ID: %d\n", authorID)
	fmt.Printf("  DB UpdatedAt: %d (%s)\n", course.UpdatedAt, time.Unix(course.UpdatedAt, 0).Format(time.RFC3339))
	fmt.Printf("  Expected UpdatedAt: %d (%s)\n", expectedUpdatedAt, time.Unix(expectedUpdatedAt, 0).Format(time.RFC3339))
	fmt.Printf("  Time Match: %v\n", course.UpdatedAt == expectedUpdatedAt)

	// 使用事务确保数据一致性
	return c.db.Transaction(func(tx *gorm.DB) error {
		// 乐观锁：检查updated_at是否匹配
		result := tx.Where("id = ? AND updated_at = ?", courseID, expectedUpdatedAt).
			Delete(&course)

		if result.Error != nil {
			fmt.Printf("DeleteCourse: delete operation failed - %v\n", result.Error)
			return fmt.Errorf("删除课程失败: %w", result.Error)
		}

		if result.RowsAffected == 0 {
			fmt.Printf("DeleteCourse: optimistic lock failed - no rows affected\n")
			return errors.New("课程已被其他用户修改，请刷新后重试")
		}

		fmt.Printf("DeleteCourse: course deleted successfully, affected rows: %d\n", result.RowsAffected)

		// 删除课程的所有课时关联
		if err := tx.Where("course_id = ?", courseID).Delete(&model.LessonCourse{}).Error; err != nil {
			fmt.Printf("DeleteCourse: failed to delete lesson associations - %v\n", err)
			return fmt.Errorf("删除课时关联失败: %w", err)
		}

		// 删除课程与班级的关联
		if err := tx.Where("course_id = ?", courseID).Delete(&model.ClassCourse{}).Error; err != nil {
			fmt.Printf("DeleteCourse: failed to delete class associations - %v\n", err)
			return fmt.Errorf("删除班级关联失败: %w", err)
		}

		fmt.Printf("DeleteCourse: all associations deleted successfully\n")
		return nil
	})
}

// ListCoursesWithPagination 分页获取课程列表
func (c *CourseDaoImpl) ListCoursesWithPagination(authorID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Course, bool, error) {
	var courses []model.Course

	// 构建查询
	query := c.db.Where("author_id = ?", authorID)

	// 分页逻辑：根据排序方向和翻页方向确定查询条件
	var needReverse bool = false
	if beginID > 0 {
		if asc {
			// 升序排列时：向前翻页获取更大的ID，向后翻页获取更小的ID
			if forward {
				query = query.Where("id > ?", beginID)
			} else {
				query = query.Where("id < ?", beginID)
				needReverse = true
			}
		} else {
			// 降序排列时：向前翻页获取更小的ID，向后翻页获取更大的ID
			if forward {
				query = query.Where("id < ?", beginID)
			} else {
				query = query.Where("id > ?", beginID)
				needReverse = true
			}
		}
	}

	// 排序逻辑：根据参数确定排序方向
	var orderClause string
	if asc {
		if needReverse {
			orderClause = "sort_order DESC, id DESC"
		} else {
			orderClause = "sort_order ASC, id ASC"
		}
	} else {
		if needReverse {
			orderClause = "sort_order ASC, id ASC"
		} else {
			orderClause = "sort_order DESC, id DESC"
		}
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

	// 如果是向上翻页，需要反转结果以保持正确的显示顺序
	if needReverse {
		for i, j := 0, len(courses)-1; i < j; i, j = i+1, j-1 {
			courses[i], courses[j] = courses[j], courses[i]
		}
	}

	return courses, hasMore, nil
}

// PublishCourse 发布/取消发布课程（乐观锁）
func (c *CourseDaoImpl) PublishCourse(courseID, authorID uint, expectedUpdatedAt int64, isPublished bool) error {
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

	// 统计课时数量（通过关联表）
	if err := c.db.Model(&model.LessonCourse{}).Where("course_id = ?", courseID).Count(&stats.LessonCount).Error; err != nil {
		return nil, err
	}

	// 统计已发布课时数量（现在移除了 is_published 字段，所以和总数相同）
	stats.PublishedLessons = stats.LessonCount

	// 统计总时长（通过关联表JOIN课时表）
	var totalDuration int
	c.db.Table("lesson_courses lc").
		Joins("JOIN lessons l ON l.id = lc.lesson_id").
		Where("lc.course_id = ?", courseID).
		Select("COALESCE(SUM(l.duration), 0)").
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

// AddLessonToCourse 添加课时到课程（已废弃，请使用 LessonDao.AddLessonToCourse）
func (c *CourseDaoImpl) AddLessonToCourse(courseID, authorID uint, lesson *model.Lesson) error {
	return errors.New("此方法已废弃，请使用 LessonDao.AddLessonToCourse")
}

// RemoveLessonFromCourse 从课程移除课时（已废弃，请使用 LessonDao.RemoveLessonFromCourse）
func (c *CourseDaoImpl) RemoveLessonFromCourse(courseID, lessonID, authorID uint, expectedUpdatedAt int64) error {
	return errors.New("此方法已废弃，请使用 LessonDao.RemoveLessonFromCourse")
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

	// 检查权限（只能复制自己的课程）
	if originalCourse.AuthorID != authorID {
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

		// 复制课时（先创建课时，再建立关联）
		for i, originalLesson := range originalCourse.Lessons {
			newLesson := model.Lesson{
				Title:        originalLesson.Title,
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

			if err := tx.Create(&newLesson).Error; err != nil {
				return fmt.Errorf("复制课时失败: %w", err)
			}

			// 创建课时-课程关联
			now := time.Now().Unix()
			lessonCourse := model.LessonCourse{
				LessonID:  newLesson.ID,
				CourseID:  course.ID,
				SortOrder: i + 1,
				CreatedAt: now,
				UpdatedAt: now,
			}

			if err := tx.Create(&lessonCourse).Error; err != nil {
				return fmt.Errorf("创建课时关联失败: %w", err)
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
