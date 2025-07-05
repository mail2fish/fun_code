package dao

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jun/fun_code/internal/model"
	"gorm.io/gorm"
)

// ClassDaoImpl 班级服务实现
type ClassDaoImpl struct {
	db *gorm.DB
}

// NewClassDao 创建班级服务实例
func NewClassDao(db *gorm.DB) ClassDao {
	return &ClassDaoImpl{db: db}
}

// CreateClass 创建班级
func (s *ClassDaoImpl) CreateClass(teacherID uint, name, description string, startDateStr, endDateStr string) (*model.Class, error) {
	// 解析日期
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		return nil, errors.New("开始日期格式无效")
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		return nil, errors.New("结束日期格式无效")
	}

	// 检查名称是否为空
	if name == "" {
		return nil, errors.New("班级名称不能为空")
	}

	// 生成唯一邀请码
	code := uuid.New().String()[:8]

	class := model.Class{
		Name:        name,
		Description: description,
		Code:        code,
		StartDate:   startDate,
		EndDate:     endDate,
		TeacherID:   teacherID,
		IsActive:    true,
	}

	if err := s.db.Create(&class).Error; err != nil {
		return nil, errors.New("创建班级失败")
	}

	return &class, nil
}

// UpdateClass 更新班级信息
func (s *ClassDaoImpl) UpdateClass(classID, teacherID uint, updates map[string]interface{}) error {
	// 检查班级是否存在且属于该教师
	var class model.Class
	if err := s.db.Where("id = ? AND teacher_id = ?", classID, teacherID).First(&class).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("班级不存在或您无权修改")
		}
		return err
	}

	// 处理日期字段
	if startDateStr, ok := updates["start_date"].(string); ok {
		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			return errors.New("开始日期格式无效")
		}
		updates["start_date"] = startDate
	}

	if endDateStr, ok := updates["end_date"].(string); ok {
		endDate, err := time.Parse("2006-01-02", endDateStr)
		if err != nil {
			return errors.New("结束日期格式无效")
		}
		updates["end_date"] = endDate
	}

	// 更新班级信息
	if err := s.db.Model(&class).Updates(updates).Error; err != nil {
		return errors.New("更新班级失败")
	}

	return nil
}

// GetClass 获取班级详情
func (s *ClassDaoImpl) GetClass(classID uint) (*model.Class, error) {
	var class model.Class
	if err := s.db.Preload("Teacher").First(&class, classID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("班级不存在")
		}
		return nil, err
	}

	// 手动加载学生列表
	var students []model.User
	if err := s.db.Table("users").
		Joins("JOIN class_users ON users.id = class_users.user_id").
		Where("class_users.class_id = ? AND class_users.is_active = ?", classID, true).
		Find(&students).Error; err == nil {
		class.Students = students
	}

	// 手动加载课程列表
	var courses []model.Course
	if err := s.db.Table("courses").
		Joins("JOIN class_courses ON courses.id = class_courses.course_id").
		Where("class_courses.class_id = ?", classID).
		Find(&courses).Error; err == nil {
		class.Courses = courses
	}

	return &class, nil
}

// ListClasses 列出教师创建的所有班级
func (s *ClassDaoImpl) ListClasses(teacherID uint) ([]model.Class, error) {
	var classes []model.Class
	if err := s.db.Where("teacher_id = ?", teacherID).Find(&classes).Error; err != nil {
		return nil, err
	}

	return classes, nil
}

// ListClassesWithPagination 分页列出Teacher的所有班级
// 参数：
// userID 为 uint 类型，代表用户ID
// pageSize 为 uint 类型，代表每页的班级数量
// beginID 为 uint 类型，代表分页的起始ID
// forward 为 bool 类型，代表是否向前分页
// asc 为 bool 类型，代表返回结果是否按升序排序
// 返回值：
// []model.ScratchProject 类型，代表分页后的班级列表
// bool 类型，代表是否还有更多班级
// error 类型，代表错误信息
// 说明：
// userID 为 0 时，返回所有用户的班级
// userID 不为 0 时，返回指定用户的班级
// pageSize 为 0 时，使用默认值 20
// asc 为 true 时，返回结果数组按 id 升序排序，代表页面按升序显示
// asc 为 false 时，返回结果数组按 id 降序排序，代表页面按降序显示
// biginID 为 0 ，asc 为 true，  order 按 id asc 排序
// biginID 为 0 ，asc 为 false， order 按 id desc 排序
// (asc == true and forward == true), 那么 where 条件为 id >= beginID, order 为 id asc
// (asc == true and forward == false)， 那么 where 条件为 id <= beginID，order 为 id desc
// (asc == false and forward == true)， 那么 where 条件为 id <= beginID，order 为 id desc
// (asc == false and forward == false)， 那么 where 条件为 id >= beginID, order 为 id asc
// 查询 limit 为 abs(pageSize)+1 条记录，如果查询结果数组 length <= pageSize 条记录，hasMore 为 false
// 查询 limit 为 abs(pageSize)+1 条记录，如果查询结果数组 length > pageSize 条记录，hasMore 为 true
func (s *ClassDaoImpl) ListClassesWithPagination(userID uint, pageSize uint, beginID uint, forward, asc bool) ([]model.Class, bool, error) {
	var classes []model.Class

	// 处理 pageSize 为 0 的情况，使用默认值 20
	if pageSize == 0 {
		pageSize = 20
	}

	// 构建基础查询
	query := s.db.Preload("Students").Preload("Courses")

	// 如果指定了用户ID，则只查询该用户的班级
	if userID > 0 {
		query = query.Where("teacher_id = ?", userID)
	}

	// 分页逻辑：根据排序方向和翻页方向确定查询条件 - 参考 lesson.go 的实现
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
			orderClause = "id DESC"
		} else {
			orderClause = "id ASC"
		}
	} else {
		if needReverse {
			orderClause = "id ASC"
		} else {
			orderClause = "id DESC"
		}
	}
	query = query.Order(orderClause)

	// 限制查询数量（多查一条用于判断是否还有更多数据）
	limit := int(pageSize + 1)
	query = query.Limit(limit)

	if err := query.Find(&classes).Error; err != nil {
		return nil, false, err
	}

	// 判断是否有更多数据
	hasMore := len(classes) > int(pageSize)
	if hasMore {
		classes = classes[:pageSize]
	}

	// 如果是向上翻页，需要反转结果以保持正确的显示顺序
	if needReverse {
		for i, j := 0, len(classes)-1; i < j; i, j = i+1, j-1 {
			classes[i], classes[j] = classes[j], classes[i]
		}
	}

	return classes, hasMore, nil
}

// DeleteClass 删除班级
func (s *ClassDaoImpl) DeleteClass(classID, teacherID uint) error {
	// 检查班级是否存在且属于该教师
	var class model.Class
	if err := s.db.Where("id = ? AND teacher_id = ?", classID, teacherID).First(&class).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("班级不存在或您无权删除")
		}
		return err
	}

	// 使用事务确保数据一致性
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 删除班级与学生的关联
		if err := tx.Where("class_id = ?", classID).Delete(&model.ClassUser{}).Error; err != nil {
			return err
		}

		// 删除班级与课程的关联
		if err := tx.Where("class_id = ?", classID).Delete(&model.ClassCourse{}).Error; err != nil {
			return err
		}

		// 删除班级
		if err := tx.Delete(&class).Error; err != nil {
			return err
		}

		return nil
	})
}

// AddStudent 添加学生到班级
func (s *ClassDaoImpl) AddStudent(classID, teacherID, studentID uint, role string) error {
	// 检查班级是否存在且属于该教师
	var class model.Class
	if err := s.db.Where("id = ? AND teacher_id = ?", classID, teacherID).First(&class).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("班级不存在或您无权操作")
		}
		return err
	}

	// 检查学生是否已在班级中
	var existingRelation model.ClassUser
	result := s.db.Where("class_id = ? AND user_id = ?", classID, studentID).First(&existingRelation)
	if result.Error == nil {
		// 学生已在班级中，可以更新角色
		existingRelation.Role = role
		existingRelation.IsActive = true
		if err := s.db.Save(&existingRelation).Error; err != nil {
			return errors.New("更新学生信息失败")
		}
		return nil
	} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return result.Error
	}

	// 添加学生到班级
	classUser := model.ClassUser{
		ClassID:  classID,
		UserID:   studentID,
		JoinedAt: time.Now().Unix(),
		Role:     role,
		IsActive: true,
	}

	if err := s.db.Create(&classUser).Error; err != nil {
		return errors.New("添加学生失败")
	}

	return nil
}

// RemoveStudent 从班级移除学生
func (s *ClassDaoImpl) RemoveStudent(classID, teacherID, studentID uint) error {
	// 检查班级是否存在且属于该教师
	var class model.Class
	if err := s.db.Where("id = ? AND teacher_id = ?", classID, teacherID).First(&class).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("班级不存在或您无权操作")
		}
		return err
	}

	// 从班级移除学生
	result := s.db.Where("class_id = ? AND user_id = ?", classID, studentID).Delete(&model.ClassUser{})
	if result.RowsAffected == 0 {
		return errors.New("学生不在班级中")
	}

	return result.Error
}

// ListStudents 列出班级中的所有学生
func (s *ClassDaoImpl) ListStudents(classID, teacherID uint) ([]model.User, error) {
	// 检查班级是否存在且属于该教师
	var class model.Class
	if err := s.db.Where("id = ? AND teacher_id = ?", classID, teacherID).First(&class).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("班级不存在或您无权查看")
		}
		return nil, err
	}

	// 获取班级中的所有学生
	var students []model.User
	if err := s.db.Model(&class).Association("Students").Find(&students); err != nil {
		return nil, err
	}

	return students, nil
}

// AddCourse 添加课程到班级
func (s *ClassDaoImpl) AddCourse(classID, teacherID, courseID uint, startDateStr, endDateStr string) error {
	// 检查班级是否存在且属于该教师
	var class model.Class
	if err := s.db.Where("id = ? AND teacher_id = ?", classID, teacherID).First(&class).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("班级不存在或您无权操作")
		}
		return err
	}

	// 检查课程是否存在
	var course model.Course
	if err := s.db.First(&course, courseID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("课程不存在")
		}
		return err
	}

	// 解析日期并转换为 Unix 时间戳
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		return errors.New("开始日期格式无效")
	}
	startDateUnix := startDate.Unix()

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		return errors.New("结束日期格式无效")
	}
	endDateUnix := endDate.Unix()

	// 检查课程是否已添加到班级
	var existingRelation model.ClassCourse
	result := s.db.Where("class_id = ? AND course_id = ?", classID, courseID).First(&existingRelation)
	if result.Error == nil {
		// 课程已添加，更新日期
		existingRelation.StartDate = startDateUnix
		existingRelation.EndDate = endDateUnix
		if err := s.db.Save(&existingRelation).Error; err != nil {
			return errors.New("更新课程信息失败")
		}
		return nil
	} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return result.Error
	}

	// 添加课程到班级
	classCourse := model.ClassCourse{
		ClassID:   classID,
		CourseID:  courseID,
		StartDate: startDateUnix,
		EndDate:   endDateUnix,
	}

	if err := s.db.Create(&classCourse).Error; err != nil {
		return errors.New("添加课程失败")
	}

	return nil
}

// RemoveCourse 从班级移除课程
func (s *ClassDaoImpl) RemoveCourse(classID, teacherID, courseID uint) error {
	// 检查班级是否存在且属于该教师
	var class model.Class
	if err := s.db.Where("id = ? AND teacher_id = ?", classID, teacherID).First(&class).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("班级不存在或您无权操作")
		}
		return err
	}

	// 从班级移除课程
	result := s.db.Where("class_id = ? AND course_id = ?", classID, courseID).Delete(&model.ClassCourse{})
	if result.RowsAffected == 0 {
		return errors.New("课程不在班级中")
	}

	return result.Error
}

// ListCourses 列出班级中的所有课程
func (s *ClassDaoImpl) ListCourses(classID, teacherID uint) ([]model.Course, error) {
	// 检查班级是否存在且属于该教师
	var class model.Class
	if err := s.db.Where("id = ? AND teacher_id = ?", classID, teacherID).First(&class).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("班级不存在或您无权查看")
		}
		return nil, err
	}

	// 获取班级中的所有课程
	var courses []model.Course
	if err := s.db.Model(&class).Association("Courses").Find(&courses); err != nil {
		return nil, err
	}

	return courses, nil
}

// ListCoursesByClass 列出班级中的所有课程（不需要权限检查）
func (s *ClassDaoImpl) ListCoursesByClass(classID uint) ([]model.Course, error) {
	// 直接获取班级中的所有课程，不进行权限检查
	var courses []model.Course
	if err := s.db.Table("courses").
		Joins("JOIN class_courses ON courses.id = class_courses.course_id").
		Where("class_courses.class_id = ?", classID).
		Find(&courses).Error; err != nil {
		return nil, err
	}

	return courses, nil
}

// JoinClass 学生加入班级
func (s *ClassDaoImpl) JoinClass(studentID uint, classCode string) error {
	// 查找班级
	var class model.Class
	if err := s.db.Where("code = ? AND is_active = ?", classCode, true).First(&class).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("班级不存在或邀请码无效")
		}
		return err
	}

	// 检查学生是否已在班级中
	var existingRelation model.ClassUser
	result := s.db.Where("class_id = ? AND user_id = ?", class.ID, studentID).First(&existingRelation)
	if result.Error == nil {
		if existingRelation.IsActive {
			return errors.New("您已经在班级中")
		}

		// 重新激活
		existingRelation.IsActive = true
		existingRelation.JoinedAt = time.Now().Unix()
		if err := s.db.Save(&existingRelation).Error; err != nil {
			return errors.New("加入班级失败")
		}
		return nil
	} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return result.Error
	}

	// 添加学生到班级
	classUser := model.ClassUser{
		ClassID:  class.ID,
		UserID:   studentID,
		JoinedAt: time.Now().Unix(),
		Role:     "student",
		IsActive: true,
	}

	if err := s.db.Create(&classUser).Error; err != nil {
		return errors.New("加入班级失败")
	}

	return nil
}

// ListJoinedClasses 列出学生加入的所有班级
func (s *ClassDaoImpl) ListJoinedClasses(studentID uint) ([]model.Class, error) {
	var classes []model.Class

	// 查询学生加入的所有班级
	if err := s.db.Joins("JOIN class_users ON class_users.class_id = classes.id").
		Where("class_users.user_id = ? AND class_users.is_active = ?", studentID, true).
		Preload("Teacher").
		Find(&classes).Error; err != nil {
		return nil, err
	}

	return classes, nil
}

// CountClasses 计算教师创建的班级总数
func (s *ClassDaoImpl) CountClasses(teacherID uint) (int64, error) {
	var total int64

	// 构建查询
	query := s.db.Model(&model.Class{})

	// 如果指定了教师ID，则只计算该教师的班级
	if teacherID > 0 {
		query = query.Where("teacher_id = ?", teacherID)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return 0, err
	}

	return total, nil
}

// GetUserClasses 获取用户参与的所有班级（包括作为教师和学生的班级）
func (s *ClassDaoImpl) GetUserClasses(userID uint) ([]model.Class, error) {
	var classes []model.Class

	// 查询用户作为教师的班级和作为学生加入的班级
	if err := s.db.Raw(`
		SELECT DISTINCT c.* FROM classes c
		LEFT JOIN class_users cu ON c.id = cu.class_id
		WHERE (c.teacher_id = ? OR (cu.user_id = ? AND cu.is_active = ?))
		ORDER BY c.id DESC
	`, userID, userID, true).Scan(&classes).Error; err != nil {
		return nil, err
	}

	// 为每个班级预加载相关数据
	for i := range classes {
		// 预加载教师信息
		if err := s.db.Model(&classes[i]).Association("Teacher").Find(&classes[i].Teacher); err != nil {
			continue // 忽略错误，继续处理其他班级
		}

		// 预加载学生信息
		var students []model.User
		if err := s.db.Table("users").
			Joins("JOIN class_users ON users.id = class_users.user_id").
			Where("class_users.class_id = ? AND class_users.is_active = ?", classes[i].ID, true).
			Find(&students).Error; err == nil {
			classes[i].Students = students
		}

		// 预加载课程信息
		var courses []model.Course
		if err := s.db.Table("courses").
			Joins("JOIN class_courses ON courses.id = class_courses.course_id").
			Where("class_courses.class_id = ?", classes[i].ID).
			Find(&courses).Error; err == nil {
			classes[i].Courses = courses
		}
	}

	return classes, nil
}

// IsLessonInClass 检查课时是否在班级中
func (s *ClassDaoImpl) IsLessonInClass(classID, courseID, lessonID uint) (bool, error) {
	// 检查课程是否在班级中
	var classCourse model.ClassCourse
	if err := s.db.Where("class_id = ? AND course_id = ?", classID, courseID).First(&classCourse).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}

	// 检查课时是否属于该课程（通过lesson_courses中间表）
	var lessonCourse model.LessonCourse
	if err := s.db.Where("lesson_id = ? AND course_id = ?", lessonID, courseID).First(&lessonCourse).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}

	return true, nil
}
