# FunCode

[中文](/Readme.zh.md) | [English](/Readme.md)

## Introduction

FunCode is a self-hosted service program for children's graphical programming with Scratch. After building, it is only a single executable file, but it integrates a student management system, Scratch graphical programming system, and server-side storage. After downloading, users can simply run the program on Windows, Mac, or Linux to have a locally deployed web service. Students can access the Scratch graphical programming system via browser, and their program files are saved directly on the server. No dedicated server is required; you can deploy it on the Internet or run it only in a local area network, making it especially suitable for small children's programming training institutions.

This project is still under development. If you are interested, you are welcome to join and improve it together.

Currently, there is a QQ group: 749870231. Welcome to join and discuss.

## Installation and Usage Guide

### Download

Download address: https://github.com/mail2fish/fun_code/releases

### Run

After running the program, a `funcode_server` directory will be automatically created to store service configuration information and students' program files.

It is recommended to place the funcode program in a separate directory for unified management of related files.

#### Running on Windows

#### Running on Mac or Linux

Open the terminal, go to the directory where the funcode program is located, and execute the following commands:

<span style="color:red">Note: Please replace ./funcode_darwin_arm64 in the command with the actual downloaded program name.</span>


```
chmod +x ./funcode_darwin_arm64
./funcode_darwin_arm64
```


After the program runs normally, the interface is as shown below:

![Running on Mac](doc/images/run_in_mac.png)

On the first run, an administrator account will be automatically created. The username is admin, and the password will be prompted once in the terminal. You can later check the default password in the `funcode_server/config/config.yaml` file. If you change the password in the admin panel later, the default password will become invalid.

In addition, on the first run, the default listening port is 8080. If port 8080 is already occupied, the program will automatically increment the port number and try other available ports (such as 8081).

### Access the Service

Open your browser and visit the address shown in the terminal to access the service.

![Accessing the service in browser](doc/images/login.png)

### System Interface

After logging in, you will enter the admin panel, where you can manage students, projects, classes, and other information.

![Admin panel](doc/images/admin.png)

### Access the Scratch Graphical Programming System

Click the "New Scratch Project" button in the interface to enter the Scratch graphical programming system.

![Scratch system](doc/images/scratch.png)

### Create User Interface

In the admin panel, click the "Create User" button to open the new user interface.

![Create user](doc/images/create_user.png)

## Build Guide

### Prerequisites
- Go 1.24+
- NodeJs 23.9.0+

### Build Commands

Get help information

```
make help
```

Available make commands:

```
  all              - 构建所有平台的项目
  clean            - 清理构建文件
  deps             - 安装 Go 依赖
  frontend-deps    - 安装前端依赖
  build-go-all     - 构建所有平台的 Go 项目
  build-go-{os}-{arch} - 构建指定平台的 Go 项目
  build-frontend   - 构建 React 前端
  build-scratch    - 构建 Scratch 项目
  dev              - 运行 Go 开发服务器
  dev-frontend     - 运行前端开发服务器
  dev-scratch      - 运行 Scratch 开发服务器
  test             - 运行 Go 测试
  test-frontend    - 运行前端测试
  test-scratch     - 运行 Scratch 测试
  fmt              - 格式化代码
  lint             - 检查代码质量
  help             - 显示帮助信息

支持的平台和架构组合:
  windows-amd64    - Windows 64位
  linux-amd64      - Linux 64位
  darwin-amd64     - macOS Intel
  darwin-arm64     - macOS ARM
```

The generated executable files are in the build directory.

## Development Guide

The project is divided into two parts: the server and the web client.

You must build the client before building the server; otherwise, even if the server is built successfully, it will not work due to the lack of the frontend.

### Client

The client code is mainly in the web directory, including two parts: scratch and react-router-www.

scratch is the client code for the Scratch graphical programming system, and react-router-www is the client code for the student management system.

#### 2.1.1 Prerequisites

Install NodeJs

#### 2.1.2 Scratch Client

The code is in the web/scratch directory. This part simply wraps the Scratch GUI API to build an interface.

##### 2.1.2.1 Build Scratch GUI

Before building web/scratch, you need to build Scratch GUI first.

Note: Do not use npm to install scratch-gui, because some code has been modified, so you need to build from source.

```
git clone https://github.com/mail2fish/scratch-gui/
git checkout -b main_fun_code origin/main_fun_code
cd scratch-gui
npm install
BUILD_MODE=dist npm run build
npm link    
```


mail2fish/scratch-gui/ is a forked and customized version from https://github.com/scratchfoundation/scratch-gui. Its develop branch will be synchronized with the original repository.

Note: Use the project's main_fun_code branch.

##### 2.1.2.2 Build web/Scratch

Build static files

```
cd web/scratch
npm link scratch-gui
npm install
npm run build
```

Start dev environment

```
cd web/scratch
npm link scratch-gui
npm start
```

#### 2.1.3 Student Management System

The code is in the web/react-router-www directory. This is a student management system developed based on ReactRouter and [shadcn](https://ui.shadcn.com/).

The project uses React-Router, so you need to install [React-Router](https://reactrouter.com/)

Build static files


```
cd web/react-router-www
npm install
npm run build

```

Start dev environment

```
cd web/react-router-www
npm install
npm run dev
```

### 2.2 Server

The server is developed in Go, based on Gin and GORM frameworks, and uses SQLite database.

The code is mainly in the internal directory.


```
go mod tidy
go build -o ./fun_code ./cmd/fun_code/main.go
```

You only need to run go build to build the program.

After the build is complete, an executable file will be generated. Run this file to start the server.

⚠️**Note: Before building the server, you must first build the client static files, because the server needs to use the static files built by the client.** 

### 2.3 Deployment on Linux

#### 2.3.1 supervisord

Used to manage the service as a daemon process.

https://github.com/ochinchina/supervisord

Do not run as root. Refer to deploy/supervisord.conf for configuration.

#### 2.3.2 Map port 80


```
sudo sysctl net.ipv4.ip_forward=1

# To make it permanent, edit /etc/sysctl.conf or create a new file under /etc/sysctl.d/, add:
# net.ipv4.ip_forward = 1
# Then run sudo sysctl -p
```


```
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
```


If you want to forward port 80 from localhost to 8080, you also need to add an OUTPUT chain rule:

```
sudo iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port 8080
# For IPv6 (if needed):
# sudo ip6tables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
# sudo ip6tables -t nat -A OUTPUT -p tcp -d ::1 --dport 80 -j REDIRECT --to-port 8080
```


```
sudo apt update
sudo apt install iptables-persistent
# During installation, you will be prompted whether to save the current IPv4 and IPv6 rules, select "Yes".
# If you modify the rules later, you need to save them manually:
sudo netfilter-persistent save
```

## Cross-platform Compilation

Using sqlite requires installing cgo.

