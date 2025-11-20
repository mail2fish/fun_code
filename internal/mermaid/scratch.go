package mermaid

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// Project represents a Scratch project.json structure
type Project struct {
	Targets []Target `json:"targets"`
}

// Target represents a Scratch target (sprites or stage)
type Target struct {
	IsStage    bool              `json:"isStage"`
	Name       string            `json:"name"`
	Blocks     map[string]Block  `json:"blocks"`
	IsVisible  bool              `json:"visible"`
	Broadcasts map[string]string `json:"broadcasts"`
}

// Block represents a Scratch block
type Block struct {
	Opcode   string                 `json:"opcode"`
	Next     *string                `json:"next"`
	Parent   *string                `json:"parent"`
	TopLevel bool                   `json:"topLevel"`
	Fields   map[string]interface{} `json:"fields"`
	Inputs   map[string]interface{} `json:"inputs"`
}

// ParseSB3 parses a Scratch .sb3 file and returns the project data
func ParseSB3(filename string) (*Project, error) {
	// Open the .sb3 file (which is a zip file)
	reader, err := zip.OpenReader(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to open sb3 file: %w", err)
	}
	defer reader.Close()

	// Find and read the project.json file
	var projectData []byte
	for _, file := range reader.File {
		if file.Name == "project.json" {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open project.json: %w", err)
			}
			projectData, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return nil, fmt.Errorf("failed to read project.json: %w", err)
			}
			break
		}
	}

	if projectData == nil {
		return nil, fmt.Errorf("project.json not found in sb3 file")
	}

	// Parse JSON
	var project Project
	err = json.Unmarshal(projectData, &project)
	if err != nil {
		return nil, fmt.Errorf("failed to parse project.json: %w", err)
	}

	return &project, nil
}

// ExtractFileName extracts the base filename without extension from a path
func ExtractFileName(filepath string) string {
	filename := filepath
	// Remove directory
	if idx := strings.LastIndex(filename, "/"); idx != -1 {
		filename = filename[idx+1:]
	} else if idx := strings.LastIndex(filename, "\\"); idx != -1 {
		filename = filename[idx+1:]
	}
	// Remove extension
	if idx := strings.LastIndex(filename, "."); idx != -1 {
		filename = filename[:idx]
	}
	return filename
}
