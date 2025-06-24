package handler

import (
	"net/http"
	"slices"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/global"
	"github.com/mail2fish/gorails/gorails"
)

const (
	ErrorCodeInvalidID     = 1
	ErrorCodeProtectedUser = 2
)

// DeleteUserParams 删除用户请求参数
type DeleteUserParams struct {
	UserID uint `json:"user_id" uri:"user_id" binding:"required"`
}

func (p *DeleteUserParams) Parse(c *gin.Context) gorails.Error {
	if err := c.ShouldBindUri(p); err != nil {
		return gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_USER, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, err)
	}
	return nil
}

// DeleteUserResponse 删除用户响应
type DeleteUserResponse struct {
	Message string `json:"message"`
}

// DeleteUserHandler 删除用户 gorails.Wrap 形式
func (h *Handler) DeleteUserHandler(c *gin.Context, params *DeleteUserParams) (*DeleteUserResponse, *gorails.ResponseMeta, gorails.Error) {
	userID := params.UserID

	// 判断是否为保护用户
	if slices.Contains(h.config.Protected.Users, userID) {
		return nil, nil, gorails.NewError(http.StatusBadRequest, gorails.ERR_HANDLER, global.ERR_MODULE_USER, global.ErrorCodeInvalidParams, global.ErrorMsgInvalidParams, nil)
	}

	// 执行删除操作
	err := h.dao.UserDao.DeleteUser(userID)
	if err != nil {
		// 判断是否为自定义错误
		if ce, ok := err.(gorails.Error); ok {
			return nil, nil, ce
		}
		// 其他未知错误
		return nil, nil, gorails.NewError(http.StatusInternalServerError, gorails.ERR_HANDLER, global.ERR_MODULE_USER, global.ErrorCodeDeleteFailed, global.ErrorMsgDeleteFailed, err)
	}

	// 返回成功响应
	return &DeleteUserResponse{Message: "用户删除成功"}, nil, nil
}
