# v0.0.9

## Feature Updates

- **Scratch Flowchart Generation**
  - Improved conditional block display: control_if and control_if_else blocks now correctly extract and display condition expressions in Chinese
  - Enhanced loop branch labels: changed from "继续循环/结束循环" to "成立/不成立" for better clarity
  - Added translation support for special Scratch values (e.g., "_edge_" displays as "舞台边缘")
  - Flowchart creation button supports right-click to open in new tab or window

## Bug Fixes

- Fixed issue where control_if and control_if_else blocks were not displaying condition expressions correctly
- Fixed ambiguous loop branch labels in generated flowcharts

# v0.0.9

## 功能更新

- **Scratch 流程图生成**
  - 改进条件块显示：control_if 和 control_if_else 块现在能正确提取并显示条件表达式（中文）
  - 优化循环分支标签：从"继续循环/结束循环"改为"成立/不成立"，语义更清晰
  - 新增特殊 Scratch 值翻译支持（如 "_edge_" 显示为"舞台边缘"）
  - 创建流程图按钮支持右键新标签页或新窗口打开

## Bug 修复

- 修复 control_if 和 control_if_else 块未正确显示条件表达式的问题
- 修复生成的流程图中循环分支标签存在歧义的问题

---

# v0.0.8

## Feature Updates

- **Monaco Editor - Python Programming Environment**
  - Full Python language support with syntax highlighting and autocompletion
  - Integrated Pyodide runtime for Python code execution in the browser
  - Debugging functionality with breakpoints, step-through debugging, and variable inspection
  - Graphical output support using Pixi.js for game development
  - Matplotlib integration for data visualization
  - Auto-save functionality with 30-second interval
  - Program history viewing and restoration
  - Save programs to local computer
  - Input support for interactive programs
  - Enhanced error handling with syntax error highlighting and line navigation
  - Panel resizing and visibility toggles for better workspace management
  - Fullscreen mode for graphical output
  - Console tabs for output, errors, and logs

- **Program Management**
  - Program list and count functionality
  - Administrator program management interface
  - Program history retrieval and display
  - Program sharing and permission verification

- **Excalidraw Integration**
  - Excalidraw editor support for flowcharts and diagrams
  - ExcalidrawPicker component for flow chart selection in lesson creation
  - Read-only access for students to view Excalidraw boards and thumbnails

- **Lesson Management**
  - Resource file management in lesson creation and editing
  - Lesson detail retrieval with preloaded resource files
  - Dynamic project type handling

- **Authentication & Routing**
  - Authentication layout for protected routes
  - Automatic redirection based on user role after login
  - Enhanced login redirection logic

- **Infrastructure Improvements**
  - API Gateway functionality and configurations
  - Static file handling optimization with pre-compressed resources support
  - File compression support using vite-plugin-compression
  - Enhanced asset handling and routing

## Bug Fixes

- Fixed API endpoint URLs in ProgramTable component
- Fixed routing paths for asset handling in server and Excalidraw editor
- Fixed input wrapper function compatibility in Monaco editor
- Fixed dependencies update issues in Monaco editor

## Refactoring

- Improved breakpoint handling and cleanup in Monaco editor
- Refactored program management page using ProgramTable component
- Optimized Monaco editor's output handling logic

# v0.0.8

## 功能更新

- **Monaco 编辑器 - Python 编程环境**
  - 完整的 Python 语言支持，包括语法高亮和自动补全
  - 集成 Pyodide 运行时，支持在浏览器中执行 Python 代码
  - 调试功能，支持断点、单步调试和变量查看
  - 使用 Pixi.js 支持图形输出，可用于游戏开发
  - 集成 Matplotlib 支持数据可视化
  - 自动保存功能，每 30 秒自动保存一次
  - 程序历史记录查看和恢复功能
  - 保存程序到本地电脑
  - 支持输入功能，可编写交互式程序
  - 增强的错误处理，支持语法错误高亮和行号定位
  - 面板大小调整和可见性切换，优化工作空间管理
  - 图形输出全屏模式
  - 控制台标签页，分别显示输出、错误和日志

- **程序管理**
  - 程序列表和计数功能
  - 管理员程序管理界面
  - 程序历史记录检索和显示
  - 程序分享和权限验证

- **Excalidraw 集成**
  - Excalidraw 编辑器支持，可用于流程图和图表绘制
  - ExcalidrawPicker 组件，支持在课程创建时选择流程图
  - 学生只读访问 Excalidraw 画板和缩略图

- **课程管理**
  - 课程创建和编辑中的资源文件管理
  - 课程详情检索，支持预加载资源文件
  - 动态项目类型处理

- **认证和路由**
  - 受保护路由的认证布局
  - 基于用户角色的登录后自动跳转
  - 增强的登录重定向逻辑

- **基础设施改进**
  - API Gateway 功能和配置
  - 静态文件处理优化，支持预压缩资源
  - 文件压缩支持，使用 vite-plugin-compression
  - 增强的资源处理和路由

## Bug 修复

- 修复 ProgramTable 组件中的 API 端点 URL
- 修复服务器和 Excalidraw 编辑器中的资源处理路由路径
- 修复 Monaco 编辑器中的输入包装函数兼容性问题
- 修复 Monaco 编辑器中的依赖更新问题

## 代码重构

- 改进 Monaco 编辑器中的断点处理和清理逻辑
- 使用 ProgramTable 组件重构程序管理页面
- 优化 Monaco 编辑器的输出处理逻辑

---

# v0.0.7

## Feature Updates

- Support for Excalidraw flowcharts

# v0.0.7 

## 功能更新

* 支持 excalidraw 流程图

---

# v0.0.6

## Feature Updates

* Completely redesigned UI: student and admin interfaces are now fully separated, with a more child-friendly look for students
* Added new management features for classes, courses, and lessons, meeting the daily needs of small training institutions
* Introduced program sharing functionality, allowing one-click sharing of student projects

## Upgrade Guide

This upgrade includes a redesign of some legacy database tables. If you are upgrading from an older version, please be sure to back up your database in advance. Then, use an SQLite tool to delete the following tables before starting the new system.

```sql
drop table classes;
drop table class_courses;
drop table courses;
```


# v0.0.6

## 功能更新

* 全面重构UI，学生端与管理端界面彻底分离，学生界面更加童趣友好
* 新增班级、课程、课件等管理功能，满足小型培训机构日常需求
* 新增程序分享功能，支持作品一键分享

## 升级指南

本次升级对部分旧表结构进行了重新设计。若需从旧版本升级，请务必提前备份数据库，并使用 sqlite 工具删除以下表格后再启动新系统。

```sql
drop table classes;
drop table class_courses;
drop table courses;
```

---

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
