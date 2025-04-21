# FunCode

## 1. 简介

FunCode 是一个少儿图形化编程Scratch的自托管服务程序（Self-Hosted Service）。它构建后只有一个可执行程序文件，但集成了学员管理系统、Scratch图形化编程系统以及服务端存储。用户下载后，无论使用的是Windows、Mac还是Linux操作系统，只需简单运行该程序，即可拥有一个部署在本地的Web服务。学员可以通过浏览器访问Scratch图形化编程系统，编辑后程序文件直接保存在服务端。它无需专门的服务器，可以选择把它部署到互联网上，也可以只在局域网内运行，所以特别适合小型的少儿编程培训机构。
 
这个项目目前还在开发中，有兴趣的朋友可以加入一起完善。

## 2. 开发指南

项目分为两个部分，一个是服务端，另一个是网页的客户端。

构建服务端之前必须先成功构建客户端，否则即使服务端构建成功，也会因为缺少前端界面，而无法使用。

### 2.1 客户端

客户端代码主要在 web 目录下, 包含两个部分 scratch 和 react-router-www。

scratch 是 Scratch 图形化编程系统的客户端代码，react-router-www 是学员管理系统的客户端代码。

#### 2.1.1 前置依赖

安装 NodeJs

#### 2.1.2 Scratch 客户端

代码在 web/scratch 目录下，这部份代码，只是简单的封装了 Scratch GUI 的 API 构建一个界面。


##### 2.1.2.1 构建 Scratch GUI

在构建 web/scratch 之前，需要先构建 Scratch GUI。

注意不能使用 npm 安装 scratch-gui，因为修改了一些代码，所以需要从源码构建。

```
git clone https://github.com/mail2fish/scratch-gui/
git checkout -b main_fun_code origin/main_fun_code
cd scratch-gui
npm install
BUILD_MODE=dist npm run build
npm link    
```

mail2fish/scratch-gui/ 是从 https://github.com/scratchfoundation/scratch-gui  Fork 出来的一个魔改版本，它的 develop 分支会和原库同步。

注意：使用项目的 main_fun_code 分支。


##### 2.1.2.2 构建 web/Scratch 

构建静态文件

```
cd web/scratch
npm link scratch-gui
npm install
npm run build
```

启动 dev 环境

```
cd web/scratch
npm link scratch-gui
npm start
```


#### 2.1.3 学员管理系统

代码在 web/react-router-www 目录下, 这是一个基于 ReactRouter 和 [shadcn](https://ui.shadcn.com/) 开发的学员管理系统。

项目使用 React-Router 构建，所以需要安装 [React-Router](https://reactrouter.com/)


构建静态文件

```
cd web/react-router-www
npm install
npm run build

```

启动 dev 环境
```
cd web/react-router-www
npm install
npm run dev
```

### 2.2 服务端

服务端使用Go语言开发，基于Gin，GORM 框架，使用 Sqllite 数据库。

代码主要在 internal 目录下。

```
go mod tidy
go build -o ./fun_code ./cmd/fun_code/main.go
```
构建程序只需要 go build 即可。

构建完成后，会生成一个可执行文件，运行该文件即可启动服务端。

⚠️**注意：构建服务端之前，必须要先构建客户端的静态文件，因为服务端需要使用客户端构建后的静态文件。** 



