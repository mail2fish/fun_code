package handler

import (
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/web"
)

type StaticHandler struct {
	wwwFS     http.FileSystem
	scratchFS http.FileSystem
}

func NewStaticHandler() (*StaticHandler, error) {
	// 获取 www 子文件系统
	wwwSubFS, err := fs.Sub(web.WWWStaticFiles, "www/dist")
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
		log.Println("scratch: " + c.Request.URL.Path)
	} else if strings.HasPrefix(c.Request.URL.Path, "/scratch") {
		fs = h.scratchFS
		c.Request.URL.Path = strings.TrimPrefix(c.Request.URL.Path, "/scratch")

		if _, err := fs.Open(c.Request.URL.Path); os.IsNotExist(err) {
			c.Request.URL.Path = "/scratch/index.html"
		}
	} else {
		fs = h.wwwFS
		if _, err := fs.Open(c.Request.URL.Path); os.IsNotExist(err) {
			c.Request.URL.Path = "/index.html"
		}
	}

	http.FileServer(fs).ServeHTTP(c.Writer, c.Request)
}
