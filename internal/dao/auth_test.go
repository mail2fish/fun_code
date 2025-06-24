package dao

import (
	"net/http"
	"testing"
	"time"

	"github.com/jun/fun_code/internal/cache"
	"github.com/jun/fun_code/internal/model"

	"github.com/jun/fun_code/internal/dao/testutils"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
)

func TestAuth(t *testing.T) {
	db := testutils.SetupTestDB()
	jwtKey := []byte("test_key")
	c := cache.NewGoCache()
	sessionCache := cache.NewUserSessionCache(c)
	authService := NewAuthDao(db, jwtKey, sessionCache, false)

	tests := []struct {
		name     string
		username string
		password string
		email    string
		wantErr  bool
	}{
		{
			name:     "正常注册",
			username: "testuser",
			password: "password123",
			email:    "test@example.com",
			wantErr:  false,
		},
		{
			name:     "重复用户名",
			username: "testuser",
			password: "password123",
			email:    "test2@example.com",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := authService.Register(tt.username, tt.password, tt.email)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// 验证用户是否已创建
				var user model.User
				err = db.Where("username = ?", tt.username).First(&user).Error
				assert.NoError(t, err)
				assert.Equal(t, tt.username, user.Username)
				assert.Equal(t, tt.email, user.Email)

				// 验证密码是否正确加密
				err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(tt.password))
				assert.NoError(t, err)
			}
		})
	}
}

func TestAuthService_Login(t *testing.T) {
	// 使用 testutils 中的函数
	db := testutils.SetupTestDB()
	jwtKey := []byte("test_key")
	c := cache.NewGoCache()
	sessionCache := cache.NewUserSessionCache(c)
	authService := NewAuthDao(db, jwtKey, sessionCache, false)

	// 创建测试用户
	password := "password123"
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	assert.NoError(t, err)

	user := model.User{
		Username: "testuser",
		Password: string(hashedPassword),
		Email:    "test@example.com",
	}

	err = db.Create(&user).Error
	assert.NoError(t, err)

	tests := []struct {
		name     string
		username string
		password string
		wantErr  bool
	}{
		{
			name:     "正常登录",
			username: "testuser",
			password: "password123",
			wantErr:  false,
		},
		{
			name:     "用户名不存在",
			username: "nonexistent",
			password: "password123",
			wantErr:  true,
		},
		{
			name:     "密码错误",
			username: "testuser",
			password: "wrongpassword",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loginResponse, err := authService.Login(tt.username, tt.password)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Empty(t, loginResponse)
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, loginResponse.Token)
				assert.NotNil(t, loginResponse.Cookie)

				// 验证 cookie 设置
				assert.Equal(t, "auth_token", loginResponse.Cookie.Name)
				assert.Equal(t, loginResponse.Token, loginResponse.Cookie.Value)
				assert.True(t, loginResponse.Cookie.HttpOnly)
				assert.True(t, loginResponse.Cookie.Secure)
				assert.Equal(t, http.SameSiteStrictMode, loginResponse.Cookie.SameSite)
				assert.Equal(t, 86400, loginResponse.Cookie.MaxAge)

				// 验证 token
				claims := &Claims{}
				parsedToken, err := jwt.ParseWithClaims(loginResponse.Token, claims, func(token *jwt.Token) (interface{}, error) {
					return jwtKey, nil
				})

				assert.NoError(t, err)
				assert.True(t, parsedToken.Valid)
				assert.Equal(t, user.ID, claims.UserID)
			}
		})
	}
}

// 添加新的测试函数
func TestAuthService_GenerateCookie(t *testing.T) {
	db := testutils.SetupTestDB()
	jwtKey := []byte("test_key")
	c := cache.NewGoCache()
	sessionCache := cache.NewUserSessionCache(c)
	authService := NewAuthDao(db, jwtKey, sessionCache, false)

	token := "test.token.string"
	cookie := authService.GenerateCookie(token)

	assert.Equal(t, "auth_token", cookie.Name)
	assert.Equal(t, token, cookie.Value)
	assert.Equal(t, "/", cookie.Path)
	assert.True(t, cookie.HttpOnly)
	assert.True(t, cookie.Secure)
	assert.Equal(t, http.SameSiteStrictMode, cookie.SameSite)
	assert.Equal(t, 86400, cookie.MaxAge)
}

func TestAuthService_ValidateToken(t *testing.T) {
	db := testutils.SetupTestDB()
	jwtKey := []byte("test_key")
	c := cache.NewGoCache()
	sessionCache := cache.NewUserSessionCache(c)
	authService := NewAuthDao(db, jwtKey, sessionCache, false)

	// 创建测试用户
	user := model.User{
		ID:       1,
		Username: "testuser",
		Password: "hashedpassword",
		Email:    "test@example.com",
	}
	err := db.Create(&user).Error
	assert.NoError(t, err)

	// 创建有效的会话记录
	session := model.UserSession{
		UserID:    1,
		SessionID: "test-session-id",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		IsActive:  true,
	}
	err = db.Create(&session).Error
	assert.NoError(t, err)

	// 创建一个有效的 token
	claims := Claims{
		UserID: 1,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "fun_code",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	validToken, err := token.SignedString(jwtKey)
	assert.NoError(t, err)

	// 创建一个过期的 token
	expiredClaims := Claims{
		UserID: 1,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-48 * time.Hour)),
			Issuer:    "fun_code",
		},
	}

	token = jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims)
	expiredToken, err := token.SignedString(jwtKey)
	assert.NoError(t, err)

	tests := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{
			name:    "有效token",
			token:   validToken,
			wantErr: false,
		},
		{
			name:    "过期token",
			token:   expiredToken,
			wantErr: true,
		},
		{
			name:    "无效token",
			token:   "invalid.token.string",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims, err := authService.ValidateToken(tt.token)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, claims)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, claims)
				assert.Equal(t, uint(1), claims.UserID)
			}
		})
	}
}
