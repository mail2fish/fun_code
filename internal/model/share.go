package model

import (
	"time"
)

// 项目类型常量
const (
	ProjectTypeScratch = 1 // Scratch项目
	// 可以在这里添加更多项目类型
	// ProjectTypeOther = 2
)

// Share 通过网页分享项目给其他人观看的模型
type Share struct {
	ID             uint       `json:"id" gorm:"primaryKey;autoIncrement"`
	ShareToken     string     `json:"share_token" gorm:"type:varchar(64);uniqueIndex;not null;comment:分享链接的唯一标识符"`
	ProjectID      uint       `json:"project_id" gorm:"not null;index;comment:被分享的项目ID"`
	ProjectType    int        `json:"project_type" gorm:"not null;default:1;comment:项目类型，1=Scratch项目"`
	UserID         uint       `json:"user_id" gorm:"not null;index;comment:分享者的用户ID"`
	Title          string     `json:"title" gorm:"type:varchar(255);comment:分享链接的标题"`
	Description    string     `json:"description" gorm:"type:text;comment:分享链接的描述"`
	ViewCount      int64      `json:"view_count" gorm:"default:0;comment:当前分享周期的访问次数"`
	TotalViewCount int64      `json:"total_view_count" gorm:"default:0;comment:总访问次数"`
	MaxViews       int64      `json:"max_views" gorm:"default:0;comment:最大访问次数，0表示无限制"`
	IsActive       bool       `json:"is_active" gorm:"default:true;comment:分享链接是否有效"`
	ExpiresAt      *time.Time `json:"expires_at" gorm:"comment:分享链接过期时间，null表示永不过期"`
	Password       string     `json:"-" gorm:"type:varchar(255);comment:访问密码，为空表示无需密码"`
	AllowDownload  bool       `json:"allow_download" gorm:"default:false;comment:是否允许下载"`
	AllowRemix     bool       `json:"allow_remix" gorm:"default:false;comment:是否允许Remix"`
	LikeCount      int64      `json:"like_count" gorm:"default:0;comment:点赞次数"`
	CreatedAt      time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"autoUpdateTime"`

	// 关联关系
	ScratchProject *ScratchProject `json:"scratch_project,omitempty" gorm:"foreignKey:ProjectID"`
	User           *User           `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// TableName 指定表名
func (Share) TableName() string {
	return "shares"
}

// IsExpired 检查分享链接是否已过期
func (s *Share) IsExpired() bool {
	if s.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*s.ExpiresAt)
}

// IsAccessible 检查分享链接是否可访问
func (s *Share) IsAccessible() bool {
	return s.IsActive && !s.IsExpired() && !s.IsViewLimitReached()
}

// IsViewLimitReached 检查是否达到访问次数限制
func (s *Share) IsViewLimitReached() bool {
	if s.MaxViews <= 0 {
		return false // 0表示无限制
	}
	return s.ViewCount >= s.MaxViews
}

// IncrementViewCount 增加访问次数
func (s *Share) IncrementViewCount() {
	s.ViewCount++
	s.TotalViewCount++
}

// ResetViewCount 重置当前周期访问次数（用于重新分享）
func (s *Share) ResetViewCount() {
	s.ViewCount = 0
}
