package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	// Keep time import if needed elsewhere, otherwise remove if ServeContent is fully replaced
	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/cache"
	"github.com/jun/fun_code/web"
)

type StaticHandler struct {
	wwwFS        http.FileSystem
	scratchFS    http.FileSystem
	excalidrawFS http.FileSystem
	cache        cache.ETagCache
}

func NewStaticHandler(cache cache.ETagCache) (*StaticHandler, error) {
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

	// 获取 excalidraw 子文件系统
	excalidrawSubFS, err := fs.Sub(web.ExcalidrawStaticFiles, "excalidraw/dist")
	if err != nil {
		return nil, err
	}

	return &StaticHandler{
		wwwFS:        http.FS(wwwSubFS),
		scratchFS:    http.FS(scratchSubFS),
		excalidrawFS: http.FS(excalidrawSubFS),
		cache:        cache,
	}, nil
}

func calculateETag(data []byte) string {
	hash := sha256.Sum256(data)
	return fmt.Sprintf(`"%s"`, hex.EncodeToString(hash[:]))
}

func (h *StaticHandler) ServeStatic(c *gin.Context) {
	var currentFS http.FileSystem
	filePath := c.Request.URL.Path

	// 根据路径选择文件系统并调整文件路径
	if strings.HasPrefix(filePath, "/static/scratch") {
		currentFS = h.scratchFS
		filePath = strings.TrimPrefix(filePath, "/static/scratch")
	} else if strings.HasPrefix(filePath, "/scratch") {
		currentFS = h.scratchFS
		filePath = strings.TrimPrefix(filePath, "/scratch")
	} else if strings.HasPrefix(filePath, "/excalidraw") {
		currentFS = h.excalidrawFS

		if filePath == "/excalidraw/new" {
			filePath = "/index.html"
		} else {
			filePath = strings.TrimPrefix(filePath, "/excalidraw")
		}

	} else if filePath == "/" {
		currentFS = h.wwwFS
		// 根路径或 /www 路径都指向 index.html
		filePath = "/index.html"
	} else if strings.HasPrefix(filePath, "/www") {
		fmt.Println("filePath www", filePath)
		if strings.HasPrefix(filePath, "/www/share") {
			currentFS = h.wwwFS
			// 根路径或 /www 路径都指向 index.html
			filePath = "/index.html"
		} else {
			fmt.Println("filePath www", filePath)
			_, exists := c.Get("userID")
			if !exists {
				c.Redirect(http.StatusFound, "/")
				return
			}
			fmt.Println("filePath www after", filePath)
			currentFS = h.wwwFS
			// 根路径或 /www 路径都指向 index.html
			filePath = "/index.html"
		}
	} else {
		// 默认 www 文件系统，路径保持不变 (e.g., /assets/...)
		currentFS = h.wwwFS
	}

	// 确保文件路径是相对路径且安全
	filePath = strings.TrimPrefix(filePath, "/")
	if filePath == "" { // 如果 TrimPrefix 后为空，说明是根目录，映射到 index.html
		filePath = "index.html"
	}
	// 清理路径，防止路径遍历攻击，并确保使用 '/' 作为分隔符
	filePath = filepath.ToSlash(filepath.Clean(filePath))
	if strings.HasPrefix(filePath, "..") { // Clean 之后仍然需要检查 ".."
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	// 打开文件
	file, err := currentFS.Open(filePath)
	if err != nil {
		// 如果文件不存在，尝试返回 www 的 index.html (适用于 SPA 路由)
		if errors.Is(err, fs.ErrNotExist) && currentFS == h.wwwFS && filepath.Ext(filePath) == "" {
			filePath = "index.html"
			file, err = currentFS.Open(filePath)
		}

		// 如果仍然错误（例如 index.html 也不存在或权限问题）
		if err != nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
	}
	defer file.Close()

	// 先从缓存获取Etag
	if cachedETag, found := h.cache.GetETag(filePath); found {
		ifnonematch := c.GetHeader("If-None-Match")
		if ifnonematch != "" {
			// 弱 ETag 比较 (W/"...") 暂不处理，这里只处理强 ETag
			if ifnonematch == cachedETag {
				c.AbortWithStatus(http.StatusNotModified)
				return
			}
		}
	}

	// 读取文件内容以计算 ETag
	// 注意：对于非常大的文件，这会消耗较多内存。可以考虑优化为流式处理或使用文件大小+修改时间作为 ETag。
	// 但对于 embed.FS，修改时间可能不准确，哈希更可靠。
	fileContent, err := io.ReadAll(file)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	// 计算 ETag
	etag := calculateETag(fileContent)

	// 将 ETag 存储到缓存
	h.cache.SetETag(filePath, etag)

	// 检查 If-None-Match 请求头
	ifnonematch := c.GetHeader("If-None-Match")
	if ifnonematch != "" {
		// 弱 ETag 比较 (W/"...") 暂不处理，这里只处理强 ETag
		if ifnonematch == etag {
			c.AbortWithStatus(http.StatusNotModified)
			return
		}
	}

	// 设置响应头
	c.Header("ETag", etag)

	// 获取 Content-Type
	contentType := mime.TypeByExtension(filepath.Ext(filePath))
	if contentType == "" {
		// 默认类型，或者可以进行更复杂的类型检测
		contentType = "application/octet-stream"
		// 对于 index.html，强制设为 text/html
		if strings.HasSuffix(filePath, ".html") {
			contentType = "text/html; charset=utf-8"
		}
	}

	c.Header("Static-File", "true")
	// 如果不是 index.html 文件，则设置 Cache-Control 头
	if !strings.HasSuffix(filePath, "index.html") {
		c.Header("Cache-Control", "public, max-age=31536000") // 设置为最长缓存时间 1 年
		// 设置 Expires 头
		expiredTime := time.Now().Add(31536000 * time.Second) // 1 年后过期
		c.Header("Expires", expiredTime.Format(time.RFC1123))
	} else {
		// index.html 不设置缓存，确保每次都能获取最新版本
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
	}
	// 使用 c.Data 提供文件内容
	c.Data(http.StatusOK, contentType, fileContent)

	// 原来的 http.FileServer 和 http.ServeContent 调用被替换
	// http.FileServer(fs).ServeHTTP(c.Writer, c.Request)
	// http.ServeContent(c.Writer, c.Request, "index.html", time.Now(), file)
}
