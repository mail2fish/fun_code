// 实现一个 API 网关代理，代理到 /api 路径下的请求到  config.Server.APIGatewayURL 地址

package server

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/jun/fun_code/internal/config"
)

// APIGatewayHandler 创建 API 网关处理器
func APIGatewayHandler(cfg *config.Config) gin.HandlerFunc {
	if cfg.Server.APIGatewayURL == "" {
		return func(c *gin.Context) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "API 网关地址未配置"})
		}
	}

	// 解析目标 API 网关地址
	targetURL, err := url.Parse(cfg.Server.APIGatewayURL)
	if err != nil {
		return func(c *gin.Context) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "API 网关地址格式错误"})
		}
	}

	// 创建反向代理
	proxy := httputil.NewSingleHostReverseProxy(targetURL)

	// 为开发环境配置 HTTPS 支持
	if targetURL.Scheme == "https" {
		// 创建自定义传输层，支持开发环境的自签名证书
		transport := &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true, // 跳过证书验证，适用于开发环境
			},
		}
		proxy.Transport = transport
	}

	// 自定义 Director 函数，修改请求
	proxy.Director = func(req *http.Request) {
		// 记录原始请求的 Host 和 Proto
		originalHost := req.Host
		originalProto := "http"
		if req.TLS != nil {
			originalProto = "https"
		}
		if xfProto := req.Header.Get("X-Forwarded-Proto"); xfProto != "" {
			originalProto = xfProto
		}

		// 设置目标主机
		req.URL.Scheme = targetURL.Scheme
		req.URL.Host = targetURL.Host

		// 基于原始请求设置转发头
		req.Header.Set("X-Forwarded-Proto", originalProto)
		req.Header.Set("X-Forwarded-Host", originalHost)

		// 追加客户端 IP 到 X-Forwarded-For
		if clientIP, _, err := net.SplitHostPort(req.RemoteAddr); err == nil {
			if prior := req.Header.Get("X-Forwarded-For"); prior != "" {
				req.Header.Set("X-Forwarded-For", prior+", "+clientIP)
			} else {
				req.Header.Set("X-Forwarded-For", clientIP)
			}
		}

		// 最后再改写 Host 交给上游
		req.Host = targetURL.Host

		fmt.Printf("API 网关请求: %s %s -> %s\n", req.Method, req.URL.Path, req.URL.String())
	}

	// 去除上游的 CORS 相关响应头，避免与本服务的 CORS 中间件重复
	proxy.ModifyResponse = func(r *http.Response) error {
		if r != nil && r.Header != nil {
			h := r.Header
			h.Del("Access-Control-Allow-Origin")
			h.Del("Access-Control-Allow-Credentials")
			h.Del("Access-Control-Allow-Headers")
			h.Del("Access-Control-Allow-Methods")
			h.Del("Access-Control-Expose-Headers")
		}
		return nil
	}

	// 自定义错误处理
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		fmt.Printf("API 网关错误: %v\n", err)
		http.Error(w, "API 网关服务器错误", http.StatusBadGateway)
	}

	return func(c *gin.Context) {
		// 设置 API 网关请求的上下文
		proxy.ServeHTTP(c.Writer, c.Request)
	}
}
