package custom_error

import (
	"fmt"
)

// 格式为：错误类型-业务模块-错误编码

// ErrorType 定义错误类型
type ErrorType int

const (
	// HANDLER Handler层错误
	HANDLER ErrorType = 1000000
	// THIRD_PARTY 第三方库错误
	THIRD_PARTY ErrorType = 2000000
	// DAO 数据访问层错误
	DAO ErrorType = 3000000
)

// ErrorCode 定义错误代码
type ErrorCode int

// CustomError 自定义应用错误类型
type CustomError struct {
	Type    ErrorType   // 错误类型
	Module  ErrorModule // 业务模块
	Code    int         // 错误代码，使用专有类型
	Message string      // 错误消息
	Err     error       // 原始错误
}

// Error 实现 error 接口
func (e *CustomError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%d] %v", e.ErrorCode(), e.Err)
	}
	return fmt.Sprintf("[%d]", e.ErrorCode())
}

// Unwrap 返回原始错误，支持 errors.Is 和 errors.As
func (e *CustomError) Unwrap() error {
	if e.Err == nil {
		return fmt.Errorf("%d-%s", e.ErrorCode(), e.Message)
	}
	return e.Err
}

// ErrorCode 获取错误代码
// 格式为：错误类型-业务模块-错误编码
func (e *CustomError) ErrorCode() ErrorCode {
	return ErrorCode(int(e.Type) + int(e.Module) + int(e.Code))
}

// NewError 创建错误
func NewError(module ErrorModule, code int, message string) *CustomError {
	return &CustomError{
		Type:    HANDLER,
		Module:  module,
		Code:    code,
		Message: message,
	}
}

// NewHandlerError 创建业务逻辑错误
func NewHandlerError(module ErrorModule, code int, message string, err error) *CustomError {
	return &CustomError{
		Type:    HANDLER,
		Module:  module,
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// NewThirdPartyError 创建第三方库错误
func NewThirdPartyError(module ErrorModule, code int, message string, err error) *CustomError {
	return &CustomError{
		Type:    THIRD_PARTY,
		Module:  module,
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// NewDaoError 创建系统错误
func NewDaoError(module ErrorModule, code int, message string, err error) *CustomError {
	return &CustomError{
		Type:    DAO,
		Module:  module,
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// IsHandlerError 判断是否为业务逻辑错误
func IsHandlerError(err error) bool {
	if err == nil {
		return false
	}
	if e, ok := err.(*CustomError); ok {
		return e.Type == HANDLER
	}
	return false
}

// IsThirdPartyError 判断是否为第三方库错误
func IsThirdPartyError(err error) bool {
	if err == nil {
		return false
	}
	if e, ok := err.(*CustomError); ok {
		return e.Type == THIRD_PARTY
	}
	return false
}

// IsServiceError 判断是否为系统错误
func IsServiceError(err error) bool {
	if err == nil {
		return false
	}
	if e, ok := err.(*CustomError); ok {
		return e.Type == DAO
	}
	return false
}

// GetErrorCode 获取错误代码
func GetErrorCode(err error) ErrorCode {
	if e, ok := err.(*CustomError); ok {
		return e.ErrorCode()
	}
	return 0
}

func IsCustomError(err error, typ ErrorType, module ErrorModule, code int) bool {
	if e, ok := err.(*CustomError); ok {
		r := e.Type == typ && e.Module == module && e.Code == code
		return r
	}
	return false
}
