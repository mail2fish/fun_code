package web

import "embed"

// 递归嵌入整个目录，确保子目录文件（如 monaco/vs/loader.js）被包含
//
//go:embed react-router-www/build/client
var WWWStaticFiles embed.FS

// 递归嵌入 public 目录，提供 /monaco 等静态资源
//
//go:embed react-router-www/public
var WWWPublicStaticFiles embed.FS

//go:embed scratch/dist
var ScratchStaticFiles embed.FS

//go:embed pyodide
var PyodideStaticFiles embed.FS

// 添加一个函数来获取 scratch 的 index.html 内容
func GetScratchIndexHTML() ([]byte, error) {
	return ScratchStaticFiles.ReadFile("scratch/dist/index.html")
}

// 添加一个函数来获取 scratch 的资源文件
func GetScratchAsset(filename string) ([]byte, error) {
	return ScratchStaticFiles.ReadFile("scratch/dist/static/assets/" + filename)
}

// 添加一个函数来获取 pyodide 的资源文件
func GetPyodideAsset(filename string) ([]byte, error) {
	return PyodideStaticFiles.ReadFile("pyodide/" + filename)
}
