package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
)

func (h *Handler) GetSearchScratch(c *gin.Context) {
	keyword := c.Query("keyword")
	userID := c.Query("user_id")
	userIDInt, err := strconv.Atoi(userID)
	if err != nil {
		userIDInt = 0
	}

	if !h.hasPermission(c, PermissionManageAll) {
		userIDInt = int(h.getUserID(c))
	}

	if keyword == "" {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeInvalidKeyword, "invalid_keyword", nil)
		c.JSON(http.StatusBadRequest, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}

	projects, err := h.dao.ScratchDao.SearchProjects(uint(userIDInt), keyword)
	if err != nil {
		e := custom_error.NewHandlerError(custom_error.SCRATCH, ErrorCodeSearchFailed, "search_failed", err)
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(e.ErrorCode()),
			Message: e.Message,
			Error:   e.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": projects})
}
