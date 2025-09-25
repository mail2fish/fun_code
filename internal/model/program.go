package model

import "time"

// Program 表示一个通用的代码程序
// 采用与 ScratchProject 相似的设计，并支持历史文件（通过 MD5 文件名区分版本）
// Ext 使用 int 存储文件后缀类型，便于快速区分程序类型
// 例如：1=py, 2=js, 3=ts, 4=go, 5=java，可按需扩展
type Program struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint      `gorm:"index" json:"user_id"`
	Name      string    `json:"name"`
	Ext       int       `gorm:"index" json:"ext"`
	MD5       string    `json:"md5"`
	FilePath  string    `json:"file_path"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (p *Program) TableName() string {
	return "programs"
}
