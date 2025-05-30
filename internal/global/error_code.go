package global

// 模块错误码
const (
	// Share 模块错误码 (1-99)
	ErrorCodeShareNotFound         = 1  // 分享不存在
	ErrorCodeProjectNotFound       = 2  // 项目不存在
	ErrorCodeUserNotFound          = 3  // 用户不存在
	ErrorCodeTokenGenerationFailed = 4  // 生成分享token失败
	ErrorCodeShareCreateFailed     = 5  // 创建分享失败
	ErrorCodeViewRecordFailed      = 6  // 记录访问失败
	ErrorCodeShareUpdateFailed     = 7  // 更新分享失败
	ErrorCodeShareDeleteFailed     = 8  // 删除分享失败
	ErrorCodeViewLimitReached      = 9  // 达到访问次数限制
	ErrorCodeShareExpired          = 10 // 分享已过期
	ErrorCodeShareInactive         = 11 // 分享已被禁用

	// User 模块错误码 (100-199)
	ErrorCodeUserCreateFailed = 100 // 创建用户失败
	ErrorCodeUserUpdateFailed = 101 // 更新用户失败
	ErrorCodeUserDeleteFailed = 102 // 删除用户失败
	ErrorCodeUserLoginFailed  = 103 // 用户登录失败

	// Project 模块错误码 (200-299)
	ErrorCodeProjectCreateFailed = 200 // 创建项目失败
	ErrorCodeProjectUpdateFailed = 201 // 更新项目失败
	ErrorCodeProjectDeleteFailed = 202 // 删除项目失败
	ErrorCodeProjectAccessDenied = 203 // 无权访问项目

	// 系统错误码 (1000+)
	ErrorCodeSystemError = 1000 // 系统错误
	ErrorCodeDBError     = 1001 // 数据库错误
	ErrorCodeRedisError  = 1002 // Redis错误
	ErrorCodeConfigError = 1003 // 配置错误
)

// 错误消息常量
const (
	// Share 模块错误消息
	ErrorMsgShareNotFound         = "分享不存在"
	ErrorMsgProjectNotFound       = "项目不存在"
	ErrorMsgUserNotFound          = "用户不存在"
	ErrorMsgTokenGenerationFailed = "生成分享token失败"
	ErrorMsgShareCreateFailed     = "创建分享失败"
	ErrorMsgViewRecordFailed      = "记录访问失败"
	ErrorMsgShareUpdateFailed     = "更新分享失败"
	ErrorMsgShareDeleteFailed     = "删除分享失败"
	ErrorMsgViewLimitReached      = "达到访问次数限制"
	ErrorMsgShareExpired          = "分享已过期"
	ErrorMsgShareInactive         = "分享已被禁用"

	// User 模块错误消息
	ErrorMsgUserCreateFailed = "创建用户失败"
	ErrorMsgUserUpdateFailed = "更新用户失败"
	ErrorMsgUserDeleteFailed = "删除用户失败"
	ErrorMsgUserLoginFailed  = "用户登录失败"

	// Project 模块错误消息
	ErrorMsgProjectCreateFailed = "创建项目失败"
	ErrorMsgProjectUpdateFailed = "更新项目失败"
	ErrorMsgProjectDeleteFailed = "删除项目失败"
	ErrorMsgProjectAccessDenied = "无权访问项目"

	// 系统错误消息
	ErrorMsgSystemError = "系统错误"
	ErrorMsgDBError     = "数据库错误"
	ErrorMsgRedisError  = "Redis错误"
	ErrorMsgConfigError = "配置错误"
)
