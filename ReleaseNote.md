# v0.0.5

## Feature Updates

* Added username display to Scratch interface

## Bug Fixes

* Fixed issue where the latest program was sometimes not visible when returning from the scratch editor interface.


# v0.0.5

## 功能更新

* Scratch 界面增加用户名显示

## Bug 修复

* 修复有时候从 scratch 编辑器界面返回，看不见最新程序的问题。


# v0.0.4

## Feature Updates

* Added sorting functionality to the Scratch project list
* Support searching Scratch projects by project name
* Support filtering Scratch projects by user

# v0.0.4

## 功能更新

* 新增 Scratch 项目列表排序功能
* 支持按项目名称搜索 Scratch 项目
* 支持按用户筛选 Scratch 项目



---

# v0.0.3

## Feature Updates

* Added history version feature: every time a Scratch program is saved, a version is generated. Users can select a historical version for editing, with up to 20 versions retained.
* Added Scratch program thumbnails, allowing users to visually identify each program.

## Bug Fixes

* Fixed the issue where the Scratch Editor's delete dialog was positioned too low to be fully visible on low-resolution screens.
* Fixed the issue where refreshing the new program creation page would generate a new program.


# v0.0.3

## 功能更新

* 增加历史版本功能，每次保持Scratch程序，都会生成一个版本，用户可以选择历史版本进行编辑，最多保存 20 个版本。
* 增加了Scratch程序的缩略图，可以直接看图知道是什么程序。


## Bug 修复

* 修复低分辨率情况下，Scratch Editor 删除对话框位置太靠下，无法看完整
* 修复刷新创建新程序页面会产生新程序的问题


--- 

# v0.0.2

A bug fix release.

## Bug Fixes

Fixed the issue where updating and saving Scratch projects was not possible.

## Scratch bundle.js Cache Optimization

Changed the cache duration to one year.

# v0.0.2
一个修复类版本。
## Bug 修复

修复无法保存更新Scratch项目的问题。

## Scratch bundle.js 缓存优化

把缓存时间改成了一年。

--- 

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
