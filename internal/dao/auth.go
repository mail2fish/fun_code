package dao

import (
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jun/fun_code/internal/cache"
	"github.com/jun/fun_code/internal/model"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthDaoImpl struct {
	db           *gorm.DB
	jwtKey       []byte
	sessionCache cache.SessionCache
}

// 修改 NewAuthDao 函数，添加缓存参数
func NewAuthDao(db *gorm.DB, jwtKey []byte, sessionCache cache.SessionCache) AuthDao {
	return &AuthDaoImpl{
		db:           db,
		jwtKey:       jwtKey,
		sessionCache: sessionCache,
	}
}

type Claims struct {
	UserID uint `json:"user_id"`
	jwt.RegisteredClaims
}

// 在 AuthServiceImpl 中实现新方法
func (s *AuthDaoImpl) GenerateCookie(token string) *http.Cookie {
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

// Login 方法，返回用户的登录 token 和 cookie，并创建一个 session id，用于后续的请求验证
// Login 方法，添加缓存逻辑
func (s *AuthDaoImpl) Login(username, password string) (string, *http.Cookie, error) {
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

	// 生成 sessionID
	sessionID := uuid.New().String()

	// 创建或更新用户会话
	session := model.UserSession{
		UserID:    user.ID,
		SessionID: sessionID,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		IsActive:  true,
	}

	// 先尝试查找现有会话
	var existingSession model.UserSession
	result := s.db.Where("user_id = ?", user.ID).First(&existingSession)

	if result.Error == nil {
		// 如果找到现有会话，更新它
		existingSession.SessionID = sessionID
		existingSession.ExpiresAt = time.Now().Add(24 * time.Hour)
		existingSession.IsActive = true
		s.db.Save(&existingSession)

		// 更新缓存
		s.sessionCache.SetSession(&existingSession)
	} else {
		// 否则创建新会话
		s.db.Create(&session)

		// 添加到缓存
		s.sessionCache.SetSession(&session)
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

// Logout 方法，添加缓存清理逻辑
func (s *AuthDaoImpl) Logout(token string) (*http.Cookie, error) {
	// 验证 cookie
	claims, err := s.ValidateToken(token)
	if err != nil {
		return nil, errors.New("无效的登录状态")
	}

	// 查找并使会话失效
	var session model.UserSession
	result := s.db.Where("user_id = ? AND is_active = ?", claims.UserID, true).First(&session)

	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户已经登出")
		}
		return nil, result.Error
	}

	// 将会话标记为非活跃
	session.IsActive = false
	s.db.Save(&session)

	// 从缓存中删除会话
	s.sessionCache.DeleteSession(claims.UserID)

	// 创建一个已过期的 cookie 来覆盖现有的 auth_token
	expiredCookie := &http.Cookie{
		Name:     "auth_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,                             // 立即过期
		Expires:  time.Now().Add(-1 * time.Hour), // 设置为过去的时间
	}

	return expiredCookie, nil
}

// ValidateToken 方法，使用缓存优化会话验证
func (s *AuthDaoImpl) ValidateToken(tokenString string) (*Claims, error) {
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

	// 首先从缓存中查找会话
	session, found := s.sessionCache.GetSession(claims.UserID)

	// 如果缓存中找到有效会话
	if found && session.IsActive && session.ExpiresAt.After(time.Now()) {
		return claims, nil
	}

	// 缓存未命中，从数据库查询
	var dbSession model.UserSession
	result := s.db.Where("user_id = ? AND is_active = ? AND expires_at > ?",
		claims.UserID, true, time.Now()).First(&dbSession)

	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("会话已过期或已登出")
		}
		return nil, result.Error
	}

	// 将查询结果存入缓存
	s.sessionCache.SetSession(&dbSession)

	return claims, nil
}

func (s *AuthDaoImpl) Register(username, password, email string) error {
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
