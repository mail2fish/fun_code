package web

import "embed"

//go:embed react-router-www/build/client/*
var WWWStaticFiles embed.FS

//go:embed scratch/dist/*
var ScratchStaticFiles embed.FS

//go:embed excalidraw/dist/*
var ExcalidrawStaticFiles embed.FS

// 添加一个函数来获取 scratch 的 index.html 内容
func GetScratchIndexHTML() ([]byte, error) {
	return ScratchStaticFiles.ReadFile("scratch/dist/index.html")
}

// 添加一个函数来获取 scratch 的资源文件
func GetScratchAsset(filename string) ([]byte, error) {
	return ScratchStaticFiles.ReadFile("scratch/dist/static/assets/" + filename)
}

// 添加一个函数来获取 excalidraw 的 index.html 内容
func GetExcalidrawIndexHTML() ([]byte, error) {
	return ExcalidrawStaticFiles.ReadFile("excalidraw/dist/index.html")
}
