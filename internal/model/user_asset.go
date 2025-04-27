package model

import "time"

type UserAsset struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID    uint      `json:"user_id" gorm:"index"`
	AssetID   string    `json:"asset_id"`
	AssetType string    `json:"asset_type"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"created_at"`
}

func (u *UserAsset) TableName() string {
	return "user_assets"
}
