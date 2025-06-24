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

	ErrorCodeInsertFailed  = 204 // 插入失败
	ErrorCodeDeleteFailed  = 205 // 删除失败
	ErrorCodeQueryFailed   = 206 // 查询失败
	ErrorCodeQueryNotFound = 207 // 查询失败
	ErrorCodeUpdateFailed  = 208 // 更新失败

	// File 模块错误码 (300-399)
	ErrorCodeFileNotFound     = 300 // 文件不存在
	ErrorCodeFileCreateFailed = 301 // 创建文件失败
	ErrorCodeFileUpdateFailed = 302 // 更新文件失败
	ErrorCodeFileDeleteFailed = 303 // 删除文件失败
	ErrorCodeFileAccessDenied = 304 // 无权访问文件
	ErrorCodeRecordNotFound   = 305 // 记录不存在
	ErrorCodeWriteFileFailed  = 306 // 写入文件失败

	// 系统错误码 (1000+)
	ErrorCodeSystemError = 1000 // 系统错误
	ErrorCodeDBError     = 1001 // 数据库错误
	ErrorCodeRedisError  = 1002 // Redis错误
	ErrorCodeConfigError = 1003 // 配置错误

	ErrorCodeInvalidParams = 400 // 无效的参数
	ErrorCodeNoPermission  = 401 // 无权限
	ErrorCodeCreateFailed  = 402 // 创建失败

)

// 错误消息常量
const (
	ErrorMsgInvalidParams = "无效的参数"
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

	ErrorMsgInsertFailed  = "插入失败"
	ErrorMsgDeleteFailed  = "删除失败"
	ErrorMsgQueryFailed   = "查询失败"
	ErrorMsgQueryNotFound = "查询失败"
	ErrorMsgUpdateFailed  = "更新失败"

	// File 模块错误消息
	ErrorMsgFileNotFound     = "文件不存在"
	ErrorMsgFileCreateFailed = "创建文件失败"
	ErrorMsgFileUpdateFailed = "更新文件失败"
	ErrorMsgFileDeleteFailed = "删除文件失败"
	ErrorMsgFileAccessDenied = "无权访问文件"
	ErrorMsgRecordNotFound   = "记录不存在"
	ErrorMsgWriteFileFailed  = "写入文件失败"

	// 系统错误消息
	ErrorMsgSystemError = "系统错误"
	ErrorMsgDBError     = "数据库错误"
	ErrorMsgRedisError  = "Redis错误"
	ErrorMsgConfigError = "配置错误"

	ErrorMsgNoPermission = "无权限"
)
