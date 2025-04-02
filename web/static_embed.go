package web

import "embed"

//go:embed www/dist/*
var WWWStaticFiles embed.FS

//go:embed scratch/dist/*
var ScratchStaticFiles embed.FS
