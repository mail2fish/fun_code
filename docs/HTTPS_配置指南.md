# HTTPS 配置指南

本服务支持5种不同的启动模式，包括HTTP和HTTPS配置。

## 支持的启动模式

### 1. 默认模式 (default)
- 只启动HTTP服务
- 这是默认配置，兼容旧版本

```yaml
server:
  mode: "default"  # 或省略此配置
  http_port: ":8080"
```

### 2. 仅HTTP模式 (http_only)
- 只启动HTTP服务
- 明确指定仅使用HTTP

```yaml
server:
  mode: "http_only"
  http_port: ":8080"
```

### 3. 仅HTTPS模式 (https_only)
- 只启动HTTPS服务
- 需要配置TLS证书

```yaml
server:
  mode: "https_only"
  https_port: ":8443"
  tls:
    cert_file: "./certs/server.crt"
    key_file: "./certs/server.key"
```

### 4. HTTP和HTTPS双服务模式 (both)
- 同时启动HTTP和HTTPS服务
- 两个端口都能正常访问

```yaml
server:
  mode: "both"
  http_port: ":8080"
  https_port: ":8443"
  tls:
    cert_file: "./certs/server.crt"
    key_file: "./certs/server.key"
```

### 5. 强制HTTPS模式 (https_redirect)
- 启动HTTP和HTTPS服务
- HTTP请求自动重定向到HTTPS

```yaml
server:
  mode: "https_redirect"
  http_port: ":8080"
  https_port: ":8443"
  tls:
    cert_file: "./certs/server.crt"
    key_file: "./certs/server.key"
```

## 快速开始

### 生成测试证书

#### Linux/macOS
```bash
./scripts/generate-cert.sh
```

#### Windows
```batch
scripts\generate-cert.bat
```

这将在 `./certs/` 目录下生成：
- `server.crt` - 证书文件
- `server.key` - 私钥文件

### 配置服务器

编辑 `config.yaml` 文件：

```yaml
server:
  mode: "https_only"  # 选择启动模式
  http_port: ":8080"   # HTTP端口
  https_port: ":8443"  # HTTPS端口
  tls:
    cert_file: "./certs/server.crt"  # 证书文件路径
    key_file: "./certs/server.key"   # 私钥文件路径
```

### 启动服务

```bash
./fun_code
```

服务启动后会显示相应模式的访问地址。

## 生产环境配置

### 使用Let's Encrypt免费证书

1. 安装certbot
```bash
# Ubuntu/Debian
sudo apt install certbot

# CentOS/RHEL
sudo yum install certbot

# macOS
brew install certbot
```

2. 生成证书
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

3. 配置服务器
```yaml
server:
  mode: "https_redirect"  # 强制HTTPS
  http_port: ":80"
  https_port: ":443"
  tls:
    cert_file: "/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
    key_file: "/etc/letsencrypt/live/yourdomain.com/privkey.pem"
```

### 使用商业证书

将证书文件放置在安全位置，并在配置文件中指定路径：

```yaml
server:
  mode: "https_redirect"
  http_port: ":80"
  https_port: ":443"
  tls:
    cert_file: "/path/to/your/certificate.crt"
    key_file: "/path/to/your/private.key"
```

## 故障排除

### 常见问题

1. **证书文件不存在**
   - 检查证书文件路径是否正确
   - 确保证书文件具有正确的读取权限

2. **证书和私钥不匹配**
   - 确保证书和私钥是配对的
   - 重新生成证书或检查文件内容

3. **端口被占用**
   - 检查端口是否被其他服务占用
   - 使用 `netstat -tlnp | grep :443` 检查端口状态

4. **浏览器显示安全警告**
   - 自签名证书会显示警告，这是正常的
   - 可以点击"高级"→"继续访问"
   - 生产环境请使用CA签发的证书

### 日志信息

服务启动时会显示当前模式和访问地址：

```
启动模式: 强制HTTPS（HTTP重定向）
服务访问地址:
- HTTPS本地访问: https://localhost:8443
- HTTPS网络访问: https://192.168.1.100:8443
- HTTP访问将自动重定向到HTTPS
```

### 测试HTTPS配置

```bash
# 测试HTTPS连接
curl -k https://localhost:8443

# 测试HTTP重定向
curl -v http://localhost:8080
```

## 安全建议

1. **私钥文件权限**：确保私钥文件只有服务运行用户可读取 (`chmod 600`)
2. **证书更新**：定期更新证书，特别是Let's Encrypt证书（90天有效期）
3. **防火墙配置**：确保防火墙允许相应端口的访问
4. **TLS版本**：服务默认支持TLS 1.2和1.3，自动选择最安全的版本

## 兼容性说明

- 保持与旧版本配置的向后兼容
- 如果只配置了 `port` 字段，服务将自动使用默认模式
- 建议迁移到新的配置格式以获得更好的HTTPS支持 