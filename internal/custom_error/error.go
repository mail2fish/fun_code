package custom_error

import (
	"fmt"
)

// ErrorType 定义错误类型
type ErrorType string

const (
	// HandlerError Handler层错误
	HandlerError ErrorType = "handler"
	// ThirdPartyError 第三方库错误
	ThirdPartyError ErrorType = "third_party"
	// ServiceError 服务层错误
	ServiceError ErrorType = "system"
)

// ErrorCode 定义错误代码类型
type ErrorCode string

// CustomError 自定义应用错误类型
type CustomError struct {
	Type    ErrorType // 错误类型
	Code    ErrorCode // 错误代码，使用专有类型
	Message string    // 错误消息
	Err     error     // 原始错误
}

// Error 实现 error 接口
func (e *CustomError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %s: %s - %v", e.Type, e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("[%s] %s: %s", e.Type, e.Code, e.Message)
}

// Unwrap 返回原始错误，支持 errors.Is 和 errors.As
func (e *CustomError) Unwrap() error {
	if e.Err == nil {
		return fmt.Errorf("%s,%s, %s", e.Type, e.Code, e.Message)
	}

	return e.Err
}

// NewHandlerError 创建业务逻辑错误
func NewHandlerError(code ErrorCode, message string) *CustomError {
	return &CustomError{
		Type:    HandlerError,
		Code:    code,
		Message: message,
	}
}

// NewThirdPartyError 创建第三方库错误
func NewThirdPartyError(code ErrorCode, message string, err error) *CustomError {
	return &CustomError{
		Type:    ThirdPartyError,
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// NewServiceError 创建系统错误
func NewServiceError(code ErrorCode, message string) *CustomError {
	return &CustomError{
		Type:    ServiceError,
		Code:    code,
		Message: message,
	}
}

// IsHandlerError 判断是否为业务逻辑错误
func IsHandlerError(err error) bool {
	if err == nil {
		return false
	}
	if e, ok := err.(*CustomError); ok {
		return e.Type == HandlerError
	}
	return false
}

// IsThirdPartyError 判断是否为第三方库错误
func IsThirdPartyError(err error) bool {
	if err == nil {
		return false
	}
	if e, ok := err.(*CustomError); ok {
		return e.Type == ThirdPartyError
	}
	return false
}

// IsServiceError 判断是否为系统错误
func IsServiceError(err error) bool {
	if err == nil {
		return false
	}
	if e, ok := err.(*CustomError); ok {
		return e.Type == ServiceError
	}
	return false
}

// GetErrorCode 获取错误代码
func GetErrorCode(err error) ErrorCode {
	if err == nil {
		return ""
	}
	if e, ok := err.(*CustomError); ok {
		return e.Code
	}
	return ""
}
