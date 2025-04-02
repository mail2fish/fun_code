package service

import (
	"errors"
	"net/http"
	"time"

	"github.com/jun/fun_code/internal/model"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthServiceImpl struct {
	db     *gorm.DB
	jwtKey []byte
}

type Claims struct {
	UserID uint `json:"user_id"`
	jwt.RegisteredClaims
}

func NewAuthService(db *gorm.DB, jwtKey []byte) AuthService {
	// 根据错误提示，需要修改 AuthService 接口或 AuthServiceImpl 结构体的实现
	// 这里我们返回实现了正确接口的结构体实例
	return &AuthServiceImpl{
		db:     db,
		jwtKey: jwtKey,
	}
}

func (s *AuthServiceImpl) Register(username, password, email string) error {
	// 检查用户名是否已存在
	var existingUser model.User
	if err := s.db.Where("username = ?", username).First(&existingUser).Error; err == nil {
		return errors.New("用户名已被注册")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// 检查邮箱是否已被使用
	if err := s.db.Where("email = ?", email).First(&existingUser).Error; err == nil {
		return errors.New("邮箱已被注册")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// bcrypt 是单向哈希函数，无法从哈希值还原原始密码
	// 这种设计是密码存储的最佳实践，即使数据库被攻破，攻击者也无法获取用户原始密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("密码加密失败")
	}

	user := model.User{
		Username: username,
		Password: string(hashedPassword),
		Email:    email,
	}

	result := s.db.Create(&user)
	if result.Error != nil {
		return errors.New("创建用户失败")
	}
	return nil
}

// 在 AuthServiceImpl 中实现新方法
func (s *AuthServiceImpl) GenerateCookie(token string) *http.Cookie {
	return &http.Cookie{
		Name:     "auth_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   true, // 仅通过 HTTPS 发送
		SameSite: http.SameSiteStrictMode,
		MaxAge:   86400, // 24小时
	}
}

func (s *AuthServiceImpl) ValidateCookie(cookie *http.Cookie) (*Claims, error) {
	if cookie == nil {
		return nil, errors.New("cookie不存在")
	}
	return s.ValidateToken(cookie.Value)
}

// 修改 Login 方法，返回 token 和 cookie
func (s *AuthServiceImpl) Login(username, password string) (string, *http.Cookie, error) {
	var user model.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, errors.New("用户不存在")
		}
		return "", nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return "", nil, errors.New("密码错误")
	}

	claims := Claims{
		UserID: user.ID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "fun_code",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(s.jwtKey)
	if err != nil {
		return "", nil, err
	}

	cookie := s.GenerateCookie(tokenString)
	return tokenString, cookie, nil
}

func (s *AuthServiceImpl) ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return s.jwtKey, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("无效的token")
	}

	return claims, nil
}
