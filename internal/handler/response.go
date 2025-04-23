package handler

// ResponseOk 响应成功
type ResponseOk struct {
	Code int         `json:"code"`           // 业务状态码，0 表示成功，非0表示各种错误
	Data interface{} `json:"data,omitempty"` // 业务数据
	Meta interface{} `json:"meta,omitempty"` // 元信息，如分页
}

type Meta struct {
	Total   int  `json:"total"`
	HasMore bool `json:"hasMore"`
}

// ResponseError 响应失败
type ResponseError struct {
	Code    int    `json:"code"`    // 业务状态码，0 表示成功，非0表示各种错误
	Message string `json:"message"` // 提示信息
	Error   string `json:"error"`   // 错误详情，成功时可省略
}
