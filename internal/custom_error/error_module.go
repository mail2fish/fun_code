package custom_error

// ErrorModule 定义错误模块
type ErrorModule int

const (
	UNKNOWN    ErrorModule = 0
	USER       ErrorModule = 100000
	SCRATCH    ErrorModule = 200000
	AUTH       ErrorModule = 300000
	USER_ASSET ErrorModule = 400000
	SHARE      ErrorModule = 500000
)
