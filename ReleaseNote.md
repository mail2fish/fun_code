# v0.0.1
The first version of fun_code supports the following features:

## Core Features
- User Management
  - User registration, login, logout
  - Password modification
- Scratch Project Management
  - Project creation, editing, deletion
  - Project file upload/download
  - Project title support (96f9366)
  - Project file history (5ae56ec)

## System Features
- Configuration Management
  - Protected users and projects configuration (5ae56ec)
  - Project creation limit function (e289274)
- Logging System
  - Log level configuration (9c4a300)
  - Log output to file or console

## Security Enhancements
- Filename sanitization (30984c3)
- Request body size limitation (8568bf9)
- Link-local IP address filtering (318b078)

## Build Improvements
- Build output includes Git commit hash (264f036)
- CGO build option control (99da288/e6cb31e)

---

# fun_code 的第一个版本，支持以下功能：

## 核心功能
- 用户管理
  - 用户注册、登录、注销
  - 密码修改
- Scratch项目管理
  - 项目创建、编辑、删除
  - 项目文件上传/下载
  - 项目标题支持(96f9366)
  - 项目文件历史记录(5ae56ec)

## 系统特性
- 配置管理
  - 支持受保护用户和项目配置(5ae56ec)
  - 项目创建限制功能(e289274)
- 日志系统
  - 日志级别配置(9c4a300)
  - 日志输出到文件或控制台

## 安全增强
- 文件名安全处理(30984c3)
- 请求体大小限制(8568bf9)
- 链路本地IP地址过滤(318b078)

## 构建改进
- 包含Git commit hash的构建输出(264f036)
- CGO构建选项控制(99da288/e6cb31e)
