package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
)

func (h *Handler) GetSearchUsers(c *gin.Context) {
	keyword := c.Query("keyword")
	users, err := h.dao.UserDao.SearchUsers(keyword)
	if err != nil {
		e := custom_error.NewThirdPartyError(custom_error.USER, ErrorCodeSearchFailed, "user.db_query_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})

		return
	}
	c.JSON(http.StatusOK, gin.H{"data": users})
}
