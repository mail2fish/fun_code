package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/custom_error"
	"github.com/jun/fun_code/internal/model"
)

// GetAllScratchProject 获取所有scratch项目
// @Summary 获取所有scratch项目
// @Description 获取所有scratch项目
// @Accept json
// @Produce json
// @Success 200 {array} model.ScratchProject
// @Router /admin/scratch/projects [get]

func (h *Handler) GetAllScratchProject(c *gin.Context) {
	// 获取分页参数
	pageSizeStr := c.DefaultQuery("pageSize", "20")
	beginIDStr := c.DefaultQuery("beginID", "0")
	forwardStr := c.DefaultQuery("forward", "true")
	ascStr := c.DefaultQuery("asc", "true")

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}

	beginID, err := strconv.ParseUint(beginIDStr, 10, 64)
	if err != nil {
		beginID = 0
	}

	// 获取语言
	lang := c.GetHeader("Accept-Language")

	// 获取项目总数
	total, err := h.dao.ScratchDao.CountProjects(0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(custom_error.GetErrorCode(err)),
			Message: h.i18n.Translate("project.count_failed", lang),
			Error:   err.Error(),
		})
		return
	}

	// 解析布尔参数
	asc := ascStr == "true"
	forward := forwardStr == "true"

	// 获取项目列表
	projects, hasMore, err := h.dao.ScratchDao.ListProjectsWithPagination(0, uint(pageSize), uint(beginID), forward, asc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(custom_error.GetErrorCode(err)),
			Message: h.i18n.Translate("project.list_failed", lang),
			Error:   err.Error(),
		})
		return
	}

	// 筛选出projects里面所有的 UserID
	userIDs := make(map[uint]bool)
	for _, project := range projects {
		userIDs[project.UserID] = true
	}
	userIDsList := make([]uint, 0, len(userIDs))
	for userID := range userIDs {
		userIDsList = append(userIDsList, userID)
	}

	// 获取所有userIDs
	users, err := h.dao.UserDao.GetUsersByIDs(userIDsList)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ResponseError{
			Code:    int(custom_error.GetErrorCode(err)),
			Message: h.i18n.Translate("user.list_failed", lang),
			Error:   err.Error(),
		})
		return
	}

	// 返回结果
	c.JSON(http.StatusOK, ResponseOk{
		Data: gin.H{
			"projects": projects,
			"users":    h.OnlyUsersIDAndNickname(users),
		},
		Meta: Meta{
			Total:   int(total),
			HasMore: hasMore,
		},
	})
}

// OnlyUsersIDAndNickname 格式化用户列表，只返回用户ID和用户名
func (h *Handler) OnlyUsersIDAndNickname(users []model.User) []gin.H {
	userMap := make([]gin.H, len(users))
	for i, user := range users {
		userMap[i] = gin.H{
			"id":   user.ID,
			"name": user.Nickname,
		}
	}
	return userMap
}
