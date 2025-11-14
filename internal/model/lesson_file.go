package model

// LessonFile 课时与资源文件的关联
type LessonFile struct {
	ID       uint `json:"id" gorm:"primaryKey;autoIncrement"`
	LessonID uint `json:"lesson_id" gorm:"index;not null;uniqueIndex:idx_lesson_file_unique"`
	FileID   uint `json:"file_id" gorm:"index;not null;uniqueIndex:idx_lesson_file_unique"`
}

func (lf *LessonFile) TableName() string {
	return "lesson_files"
}
