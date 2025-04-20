package dao

import (
	"fmt"
	"testing"
	"time"

	"github.com/jun/fun_code/internal/dao/testutils"
	"github.com/jun/fun_code/internal/model"
	"github.com/stretchr/testify/assert"
)

// 测试创建班级
func TestCreateClass(t *testing.T) {
	// 设置测试数据库
	db := testutils.SetupTestDB()
	classService := NewClassService(db)

	// 测试数据
	teacherID := uint(1)
	name := "测试班级"
	description := "这是一个测试班级"
	startDate := "2023-01-01"
	endDate := "2023-12-31"

	// 测试用例
	tests := []struct {
		name        string
		teacherID   uint
		className   string
		description string
		startDate   string
		endDate     string
		wantErr     bool
	}{
		{
			name:        "正常创建班级",
			teacherID:   teacherID,
			className:   name,
			description: description,
			startDate:   startDate,
			endDate:     endDate,
			wantErr:     false,
		},
		{
			name:        "无效的开始日期",
			teacherID:   teacherID,
			className:   name,
			description: description,
			startDate:   "无效日期",
			endDate:     endDate,
			wantErr:     true,
		},
		{
			name:        "无效的结束日期",
			teacherID:   teacherID,
			className:   name,
			description: description,
			startDate:   startDate,
			endDate:     "无效日期",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 执行测试
			class, err := classService.CreateClass(tt.teacherID, tt.className, tt.description, tt.startDate, tt.endDate)

			// 验证结果
			if (err != nil) != tt.wantErr {
				t.Errorf("CreateClass() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				assert.NotNil(t, class)
				assert.Equal(t, tt.className, class.Name)
				assert.Equal(t, tt.description, class.Description)
				assert.Equal(t, tt.teacherID, class.TeacherID)
				assert.True(t, class.IsActive)
				assert.NotEmpty(t, class.Code)

				// 验证日期格式正确
				expectedStartDate, _ := time.Parse("2006-01-02", tt.startDate)
				expectedEndDate, _ := time.Parse("2006-01-02", tt.endDate)
				assert.Equal(t, expectedStartDate.Format("2006-01-02"), class.StartDate.Format("2006-01-02"))
				assert.Equal(t, expectedEndDate.Format("2006-01-02"), class.EndDate.Format("2006-01-02"))
			}
		})
	}
}

// 测试更新班级
func TestUpdateClass(t *testing.T) {
	// 设置测试数据库
	db := testutils.SetupTestDB()
	classService := NewClassService(db)

	// 先创建一个班级用于测试
	teacherID := uint(1)
	name := "原始班级名称"
	description := "原始描述"
	startDate := "2023-01-01"
	endDate := "2023-12-31"

	class, err := classService.CreateClass(teacherID, name, description, startDate, endDate)
	if err != nil {
		t.Fatalf("创建测试班级失败: %v", err)
	}

	// 测试用例
	tests := []struct {
		name      string
		classID   uint
		teacherID uint
		updates   map[string]interface{}
		wantErr   bool
	}{
		{
			name:      "正常更新班级",
			classID:   class.ID,
			teacherID: teacherID,
			updates: map[string]interface{}{
				"name":        "更新后的班级名称",
				"description": "更新后的描述",
				"start_date":  "2023-02-01",
				"end_date":    "2023-11-30",
			},
			wantErr: false,
		},
		{
			name:      "无效的班级ID",
			classID:   999,
			teacherID: teacherID,
			updates: map[string]interface{}{
				"name": "更新后的班级名称",
			},
			wantErr: true,
		},
		{
			name:      "无效的教师ID",
			classID:   class.ID,
			teacherID: 999,
			updates: map[string]interface{}{
				"name": "更新后的班级名称",
			},
			wantErr: true,
		},
		{
			name:      "无效的开始日期",
			classID:   class.ID,
			teacherID: teacherID,
			updates: map[string]interface{}{
				"start_date": "无效日期",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 执行测试
			err := classService.UpdateClass(tt.classID, tt.teacherID, tt.updates)

			// 验证结果
			if (err != nil) != tt.wantErr {
				t.Errorf("UpdateClass() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				// 获取更新后的班级
				updatedClass, err := classService.GetClass(tt.classID)
				assert.NoError(t, err)
				assert.NotNil(t, updatedClass)

				// 验证更新是否生效
				if name, ok := tt.updates["name"].(string); ok {
					assert.Equal(t, name, updatedClass.Name)
				}
				if description, ok := tt.updates["description"].(string); ok {
					assert.Equal(t, description, updatedClass.Description)
				}
				if startDateStr, ok := tt.updates["start_date"].(string); ok {
					expectedStartDate, _ := time.Parse("2006-01-02", startDateStr)
					assert.Equal(t, expectedStartDate.Format("2006-01-02"), updatedClass.StartDate.Format("2006-01-02"))
				}
				if endDateStr, ok := tt.updates["end_date"].(string); ok {
					expectedEndDate, _ := time.Parse("2006-01-02", endDateStr)
					assert.Equal(t, expectedEndDate.Format("2006-01-02"), updatedClass.EndDate.Format("2006-01-02"))
				}
			}
		})
	}
}

// 测试获取班级详情
func TestGetClass(t *testing.T) {
	// 设置测试数据库
	db := testutils.SetupTestDB()
	classService := NewClassService(db)

	// 先创建一个班级用于测试
	teacherID := uint(1)
	name := "测试班级"
	description := "这是一个测试班级"
	startDate := "2023-01-01"
	endDate := "2023-12-31"

	class, err := classService.CreateClass(teacherID, name, description, startDate, endDate)
	if err != nil {
		t.Fatalf("创建测试班级失败: %v", err)
	}

	// 测试用例
	tests := []struct {
		name      string
		classID   uint
		wantErr   bool
		checkFunc func(*testing.T, *model.Class)
	}{
		{
			name:    "正常获取班级",
			classID: class.ID,
			wantErr: false,
			checkFunc: func(t *testing.T, c *model.Class) {
				assert.Equal(t, name, c.Name)
				assert.Equal(t, description, c.Description)
				assert.Equal(t, teacherID, c.TeacherID)
			},
		},
		{
			name:    "班级不存在",
			classID: 999,
			wantErr: true,
			checkFunc: func(t *testing.T, c *model.Class) {
				assert.Nil(t, c)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 执行测试
			gotClass, err := classService.GetClass(tt.classID)

			// 验证结果
			if (err != nil) != tt.wantErr {
				t.Errorf("GetClass() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			tt.checkFunc(t, gotClass)
		})
	}
}

// 测试列出教师的班级
func TestListClasses(t *testing.T) {
	// 设置测试数据库
	db := testutils.SetupTestDB()
	classService := NewClassService(db)

	// 创建多个班级用于测试
	teacherID := uint(1)
	otherTeacherID := uint(2)
	classCount := 3

	for i := 0; i < classCount; i++ {
		name := fmt.Sprintf("测试班级 %d", i+1)
		description := fmt.Sprintf("这是测试班级 %d", i+1)
		startDate := "2023-01-01"
		endDate := "2023-12-31"

		_, err := classService.CreateClass(teacherID, name, description, startDate, endDate)
		if err != nil {
			t.Fatalf("创建测试班级失败: %v", err)
		}
	}

	// 为其他教师创建一个班级
	_, err := classService.CreateClass(otherTeacherID, "其他教师的班级", "描述", "2023-01-01", "2023-12-31")
	if err != nil {
		t.Fatalf("创建其他教师的班级失败: %v", err)
	}

	// 测试用例
	tests := []struct {
		name      string
		teacherID uint
		wantCount int
		wantErr   bool
	}{
		{
			name:      "正常列出班级",
			teacherID: teacherID,
			wantCount: classCount,
			wantErr:   false,
		},
		{
			name:      "教师没有班级",
			teacherID: 999,
			wantCount: 0,
			wantErr:   false,
		},
		{
			name:      "其他教师的班级",
			teacherID: otherTeacherID,
			wantCount: 1,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 执行测试
			classes, err := classService.ListClasses(tt.teacherID)

			// 验证结果
			if (err != nil) != tt.wantErr {
				t.Errorf("ListClasses() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			assert.Equal(t, tt.wantCount, len(classes))

			// 验证所有班级都属于指定教师
			for _, class := range classes {
				assert.Equal(t, tt.teacherID, class.TeacherID)
			}
		})
	}
}

// 测试删除班级
func TestDeleteClass(t *testing.T) {
	// 设置测试数据库
	db := testutils.SetupTestDB()
	classService := NewClassService(db)

	// 先创建一个班级用于测试
	teacherID := uint(1)
	otherTeacherID := uint(2)
	name := "测试班级"
	description := "这是一个测试班级"
	startDate := "2023-01-01"
	endDate := "2023-12-31"

	class, err := classService.CreateClass(teacherID, name, description, startDate, endDate)
	if err != nil {
		t.Fatalf("创建测试班级失败: %v", err)
	}

	// 测试用例
	tests := []struct {
		name      string
		classID   uint
		teacherID uint
		wantErr   bool
	}{
		{
			name:      "正常删除班级",
			classID:   class.ID,
			teacherID: teacherID,
			wantErr:   false,
		},
		{
			name:      "班级不存在",
			classID:   999,
			teacherID: teacherID,
			wantErr:   true,
		},
		{
			name:      "无权删除班级",
			classID:   class.ID,
			teacherID: otherTeacherID,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 执行测试
			err := classService.DeleteClass(tt.classID, tt.teacherID)

			// 验证结果
			if (err != nil) != tt.wantErr {
				t.Errorf("DeleteClass() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				// 验证班级已被删除
				_, err := classService.GetClass(tt.classID)
				assert.Error(t, err)
			}
		})
	}
}
