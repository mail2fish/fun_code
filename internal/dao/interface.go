package dao

import (
	"net/http"
)

type Dao struct {
	AuthDao      AuthDao
	UserDao      UserDao
	FileDao      FileDao
	ClassDao     ClassDao
	CourseDao    CourseDao
	ScratchDao   ScratchDao
	UserAssetDao UserAssetDao
	ShareDao     ShareDao
}

type AuthDao interface {
	Register(username, password, email string) error
	Login(username, password string) (string, *http.Cookie, error)
	Logout(token string) (*http.Cookie, error)
	ValidateToken(tokenString string) (*Claims, error)
	GenerateCookie(token string) *http.Cookie
}
