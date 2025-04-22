package locales

import "embed"

//go:embed *.yaml
var LocaleFiles embed.FS
