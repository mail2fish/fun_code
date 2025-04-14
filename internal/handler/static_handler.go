package handler

import (
	"io/fs"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/web"
)

type StaticHandler struct {
	wwwFS     http.FileSystem
	scratchFS http.FileSystem
}

func NewStaticHandler() (*StaticHandler, error) {
	// 获取 www 子文件系统
	wwwSubFS, err := fs.Sub(web.WWWStaticFiles, "react-router-www/build/client")
	if err != nil {
		return nil, err
	}

	// 获取 scratch 子文件系统
	scratchSubFS, err := fs.Sub(web.ScratchStaticFiles, "scratch/dist")
	if err != nil {
		return nil, err
	}

	return &StaticHandler{
		wwwFS:     http.FS(wwwSubFS),
		scratchFS: http.FS(scratchSubFS),
	}, nil
}

func (h *StaticHandler) ServeStatic(c *gin.Context) {
	// 根据路径选择文件系统
	var fs http.FileSystem

	if strings.HasPrefix(c.Request.URL.Path, "/static/scratch") {
		fs = h.scratchFS
		c.Request.URL.Path = strings.TrimPrefix(c.Request.URL.Path, "/static/scratch")
	} else if strings.HasPrefix(c.Request.URL.Path, "/scratch") {
		fs = h.scratchFS
		c.Request.URL.Path = strings.TrimPrefix(c.Request.URL.Path, "/scratch")
	} else if c.Request.URL.Path == "/" || strings.HasPrefix(c.Request.URL.Path, "/www") {
		// 直接返回 index.html 文件内容
		file, err := h.wwwFS.Open("/index.html")
		if err != nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		defer file.Close()

		http.ServeContent(c.Writer, c.Request, "index.html", time.Now(), file)
		return
	} else {
		fs = h.wwwFS
	}

	http.FileServer(fs).ServeHTTP(c.Writer, c.Request)
}
