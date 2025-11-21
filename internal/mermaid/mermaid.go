package mermaid

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// IDMapper maps Scratch block IDs to safe Mermaid node IDs
type IDMapper struct {
	idMap   map[string]string
	counter int
}

// OpcodeTranslator maps opcode to Chinese labels
type OpcodeTranslator struct {
	translations map[string]string
}

// NewIDMapper creates a new ID mapper
func NewIDMapper() *IDMapper {
	return &IDMapper{
		idMap:   make(map[string]string),
		counter: 0,
	}
}

// NewOpcodeTranslator creates a new opcode translator
func NewOpcodeTranslator() *OpcodeTranslator {
	// Load translations from zh-cn.json using embed
	translator := &OpcodeTranslator{
		translations: make(map[string]string),
	}

	// Read translations from embedded file
	if data, err := TranslationsFS.ReadFile("zh-cn.json"); err == nil {
		var translations map[string]string
		if err := json.Unmarshal(data, &translations); err == nil {
			translator.translations = translations
		}
	}

	return translator
}

// Translate translates an opcode to Chinese label
func (t *OpcodeTranslator) Translate(opcode string) string {
	// Convert opcode like "motion_gotoxy" to "MOTION_GOTOXY" key format
	key := strings.ToUpper(strings.ReplaceAll(opcode, ".", "_"))

	if translation, exists := t.translations[key]; exists {
		return translation
	}

	// If no translation found, return a simplified version of the opcode
	parts := strings.Split(opcode, "_")
	if len(parts) >= 2 {
		return strings.Join(parts[1:], "_")
	}
	return opcode
}

// GetSafeID converts a Scratch block ID to a safe Mermaid ID
func (m *IDMapper) GetSafeID(originalID string) string {
	// Check if already mapped
	if safeID, exists := m.idMap[originalID]; exists {
		return safeID
	}

	// Generate a new safe ID using MD5 hash
	hash := md5.Sum([]byte(originalID))
	safeID := fmt.Sprintf("%x", hash)

	// Store the mapping
	m.idMap[originalID] = safeID
	return safeID
}

// generateID generates a safe ID from any string using MD5
func generateID(text string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(text)))
}

// GenerateMermaid generates a Mermaid flowchart from a Scratch project
func GenerateMermaid(project *Project, rootName string) string {
	var builder strings.Builder

	// Create ID mapper for all blocks
	idMapper := NewIDMapper()

	// Create translator
	translator := NewOpcodeTranslator()

	// Write header
	builder.WriteString("flowchart TD\n")
	builder.WriteString("    Start[")
	builder.WriteString(rootName)
	builder.WriteString("]\n")

	// Process each target
	for _, target := range project.Targets {
		// Skip stage if it has no blocks
		if target.IsStage && len(target.Blocks) == 0 {
			continue
		}

		// Skip invisible sprites without blocks
		if !target.IsStage && len(target.Blocks) == 0 {
			continue
		}

		// Create a branch for this target
		// Use MD5 hash for safe node ID
		branchHash := generateID(target.Name)
		builder.WriteString(fmt.Sprintf("    Start --> %s[%s]\n", branchHash, target.Name))

		// Find all top-level blocks (program entry points)
		topLevelBlocks := findTopLevelBlocks(target.Blocks)

		// Generate flowchart for each top-level block chain
		for i, topBlockID := range topLevelBlocks {
			if topBlockID == "" {
				continue
			}

			prefix := branchHash
			if len(topLevelBlocks) > 1 {
				// Use index in hash for multiple chains
				prefix = fmt.Sprintf("%s_%d", branchHash, i)
			}

			// Connect the first block to the character node
			safeID := idMapper.GetSafeID(topBlockID)
			firstNodeName := fmt.Sprintf("%s_%s", prefix, safeID)
			builder.WriteString(fmt.Sprintf("    %s --> %s\n", branchHash, firstNodeName))

			visited := make(map[string]bool)
			generateBlockFlow(&builder, target.Blocks, topBlockID, prefix, 0, visited, idMapper, translator, target.Broadcasts)
		}
	}

	return builder.String()
}

// findTopLevelBlocks finds all top-level blocks (entry points)
func findTopLevelBlocks(blocks map[string]Block) []string {
	var topLevelIDs []string
	for id, block := range blocks {
		if block.TopLevel && block.Parent == nil {
			topLevelIDs = append(topLevelIDs, id)
		}
	}
	return topLevelIDs
}

// generateBlockFlow recursively generates the flowchart for a block chain
func generateBlockFlow(builder *strings.Builder, blocks map[string]Block, blockID string, prefix string, depth int, visited map[string]bool, idMapper *IDMapper, translator *OpcodeTranslator, broadcasts map[string]string) {
	if blockID == "" || visited[blockID] {
		return
	}
	visited[blockID] = true

	// Limit recursion depth
	if depth > 500 {
		safeID := idMapper.GetSafeID(blockID)
		builder.WriteString(fmt.Sprintf("    %s_%s --> %s_%s_loop[无限循环...]\n", prefix, safeID, prefix, safeID))
		return
	}

	block, exists := blocks[blockID]
	if !exists {
		return
	}

	// Get block label
	label := GetBlockLabel(block, translator, broadcasts, blocks)
	safeID := idMapper.GetSafeID(blockID)
	nodeName := fmt.Sprintf("%s_%s", prefix, safeID)

	// Determine node shape based on opcode type
	nodeShape, nodeShapeClose := getNodeShape(block.Opcode)

	// Write node with appropriate shape
	builder.WriteString(fmt.Sprintf("    %s%s%s%s\n", nodeName, nodeShape, label, nodeShapeClose))

	// Handle control blocks with substacks
	if _, handled := HandleControlBlock(builder, blocks, block, nodeName, prefix, blockID, depth, visited, idMapper, translator, broadcasts); handled {
		return
	}

	// Follow next block
	if block.Next != nil {
		nextSafeID := idMapper.GetSafeID(*block.Next)
		nextNodeName := fmt.Sprintf("%s_%s", prefix, nextSafeID)
		builder.WriteString(fmt.Sprintf("    %s --> %s\n", nodeName, nextNodeName))
		generateBlockFlow(builder, blocks, *block.Next, prefix, depth+1, visited, idMapper, translator, broadcasts)
	} else if strings.HasPrefix(block.Opcode, "event_") {
		// Event blocks might be standalone
		builder.WriteString(fmt.Sprintf("    %s --> %s_end[结束]\n", nodeName, nodeName))
	}
}

// HandleControlBlock handles special control blocks (loops, conditionals)
func HandleControlBlock(builder *strings.Builder, blocks map[string]Block, block Block, nodeName, prefix, blockID string, depth int, visited map[string]bool, idMapper *IDMapper, translator *OpcodeTranslator, broadcasts map[string]string) (bool, bool) {

	// Handle FOREVER loop
	if block.Opcode == "control_forever" {
		if substack := getSubstackBlockID(block); substack != "" {
			substackSafeID := idMapper.GetSafeID(substack)
			substackNode := fmt.Sprintf("%s_%s", prefix, substackSafeID)
			builder.WriteString(fmt.Sprintf("    %s --> %s\n", nodeName, substackNode))

			// Track visited blocks for this loop to avoid cycles in nested structures
			loopVisited := make(map[string]bool)
			for k, v := range visited {
				loopVisited[k] = v
			}

			// Generate the entire substack chain
			generateBlockFlow(builder, blocks, substack, prefix, depth+1, loopVisited, idMapper, translator, broadcasts)

			// Find the last block in the substack and loop back to the forever block
			lastBlockID := findLastBlockInChain(blocks, substack)
			if lastBlockID != "" {
				lastSafeID := idMapper.GetSafeID(lastBlockID)
				lastNodeName := fmt.Sprintf("%s_%s", prefix, lastSafeID)
				builder.WriteString(fmt.Sprintf("    %s --> %s\n", lastNodeName, nodeName))
			}
		}
		return true, true
	}

	// Handle IF block
	if block.Opcode == "control_if" {
		hasSubstack := false
		if substack := getSubstackBlockID(block); substack != "" {
			substackSafeID := idMapper.GetSafeID(substack)
			substackNode := fmt.Sprintf("%s_%s", prefix, substackSafeID)
			// 是：条件满足，执行 SUBSTACK
			builder.WriteString(fmt.Sprintf("    %s -->|是| %s[执行条件分支]\n", nodeName, substackNode))
			generateBlockFlow(builder, blocks, substack, prefix, depth+1, visited, idMapper, translator, broadcasts)

			// 找到 substack 的最后一个 block 并连接到 next
			lastBlockID := findLastBlockInChain(blocks, substack)
			if lastBlockID != "" && block.Next != nil {
				lastSafeID := idMapper.GetSafeID(lastBlockID)
				lastNodeName := fmt.Sprintf("%s_%s", prefix, lastSafeID)
				nextSafeID := idMapper.GetSafeID(*block.Next)
				nextNodeName := fmt.Sprintf("%s_%s", prefix, nextSafeID)
				builder.WriteString(fmt.Sprintf("    %s --> %s\n", lastNodeName, nextNodeName))

				// 标记已经有路径到 next 了，所以"否"分支只需要添加箭头，不需要再次调用 generateBlockFlow
				hasSubstack = true
			}
		}

		// 否：条件不满足，直接跳到 next
		if block.Next != nil {
			nextSafeID := idMapper.GetSafeID(*block.Next)
			nextNodeName := fmt.Sprintf("%s_%s", prefix, nextSafeID)
			builder.WriteString(fmt.Sprintf("    %s -->|否| %s\n", nodeName, nextNodeName))

			// 只有当"是"分支没有连接到 next 时才需要继续处理
			if !hasSubstack {
				generateBlockFlow(builder, blocks, *block.Next, prefix, depth+1, visited, idMapper, translator, broadcasts)
			}
		} else {
			// 如果没有 next，添加"否"分支指向结束
			endNodeName := fmt.Sprintf("%s_end", nodeName)
			builder.WriteString(fmt.Sprintf("    %s -->|否| %s[结束]\n", nodeName, endNodeName))
		}
		return true, true
	}

	// Handle IF-ELSE block
	if block.Opcode == "control_if_else" {
		// Main substack
		if substack1 := getSubstackBlockID(block); substack1 != "" {
			substack1SafeID := idMapper.GetSafeID(substack1)
			substackNode := fmt.Sprintf("%s_%s_1", prefix, substack1SafeID)
			builder.WriteString(fmt.Sprintf("    %s -->|是| %s[执行真分支]\n", nodeName, substackNode))
			generateBlockFlow(builder, blocks, substack1, fmt.Sprintf("%s_%s_1", prefix, substack1SafeID), depth+1, visited, idMapper, translator, broadcasts)
		}

		// Else substack
		if substack2 := getSubstack2BlockID(block); substack2 != "" {
			substack2SafeID := idMapper.GetSafeID(substack2)
			substackNode := fmt.Sprintf("%s_%s_2", prefix, substack2SafeID)
			builder.WriteString(fmt.Sprintf("    %s -->|否| %s[执行假分支]\n", nodeName, substackNode))
			generateBlockFlow(builder, blocks, substack2, fmt.Sprintf("%s_%s_2", prefix, substack2SafeID), depth+1, visited, idMapper, translator, broadcasts)
		}

		// Continue to next block
		if block.Next != nil {
			nextSafeID := idMapper.GetSafeID(*block.Next)
			nextNodeName := fmt.Sprintf("%s_%s", prefix, nextSafeID)
			builder.WriteString(fmt.Sprintf("    %s --> %s\n", nodeName, nextNodeName))
			generateBlockFlow(builder, blocks, *block.Next, prefix, depth+1, visited, idMapper, translator, broadcasts)
		}
		return true, true
	}

	// Handle REPEAT loop
	if block.Opcode == "control_repeat" || block.Opcode == "control_repeat_until" {
		var lastNodeName string
		if substack := getSubstackBlockID(block); substack != "" {
			substackSafeID := idMapper.GetSafeID(substack)
			substackNode := fmt.Sprintf("%s_%s", prefix, substackSafeID)

			// 连接到循环体的第一个节点
			builder.WriteString(fmt.Sprintf("    %s --> %s\n", nodeName, substackNode))

			// 为循环体生成单独的 visited 副本，避免与外层循环互相污染
			loopVisited := make(map[string]bool)
			for k, v := range visited {
				loopVisited[k] = v
			}

			// 生成循环体
			generateBlockFlow(builder, blocks, substack, prefix, depth+1, loopVisited, idMapper, translator, broadcasts)

			// 循环体最后一个节点回到当前循环节点
			lastBlockID := findLastBlockInSubstack(blocks, substack)
			if lastBlockID != "" {
				lastSafeID := idMapper.GetSafeID(lastBlockID)
				lastNodeName = fmt.Sprintf("%s_%s", prefix, lastSafeID)
				builder.WriteString(fmt.Sprintf("    %s --> %s\n", lastNodeName, nodeName))
			} else {
				// 如果循环体为空，直接回到当前节点
				builder.WriteString(fmt.Sprintf("    %s --> %s\n", substackNode, nodeName))
			}
		}

		// 循环完成后，继续执行下一个块（循环体整体视为一个节点）
		if block.Next != nil {
			nextSafeID := idMapper.GetSafeID(*block.Next)
			nextNodeName := fmt.Sprintf("%s_%s", prefix, nextSafeID)
			if lastNodeName != "" {
				builder.WriteString(fmt.Sprintf("    %s --> %s\n", lastNodeName, nextNodeName))
			} else {
				builder.WriteString(fmt.Sprintf("    %s --> %s\n", nodeName, nextNodeName))
			}
			generateBlockFlow(builder, blocks, *block.Next, prefix, depth+1, visited, idMapper, translator, broadcasts)
		}
		return true, true
	}

	return false, false
}

// getSubstackBlockID extracts the substack block ID from a block's inputs
func getSubstackBlockID(block Block) string {
	if inputs, ok := block.Inputs["SUBSTACK"].([]interface{}); ok && len(inputs) >= 2 {
		if id, ok := inputs[1].(string); ok {
			return id
		}
	}
	return ""
}

// findLastBlockInSubstack finds the last block in a substack chain, without following next blocks
func findLastBlockInSubstack(blocks map[string]Block, startID string) string {
	if startID == "" {
		return ""
	}

	block, exists := blocks[startID]
	if !exists {
		return ""
	}

	// If there's a next block, continue the chain (but don't follow next blocks of control blocks)
	if block.Next != nil {
		return findLastBlockInSubstack(blocks, *block.Next)
	}

	// If this is a control block with substack, we need to recursively find the last block in the substack
	if substackID := getSubstackBlockID(block); substackID != "" {
		// First, follow the substack
		substackLastID := findLastBlockInSubstack(blocks, substackID)
		if substackLastID != "" {
			return substackLastID
		}
	}

	// This is the last block
	return startID
}

// findLastBlockInChain finds the last block in a chain, handling nested control structures
func findLastBlockInChain(blocks map[string]Block, startID string) string {
	if startID == "" {
		return ""
	}

	block, exists := blocks[startID]
	if !exists {
		return ""
	}

	// If this is a control block with substack, we need to recursively find the last block
	if substackID := getSubstackBlockID(block); substackID != "" {
		// First, follow the substack
		substackLastID := findLastBlockInChain(blocks, substackID)
		if substackLastID != "" {
			// After substack ends, continue with next block if it exists
			if block.Next != nil {
				return findLastBlockInChain(blocks, *block.Next)
			}
			return substackLastID
		}
	}

	// If there's a next block, continue the chain
	if block.Next != nil {
		return findLastBlockInChain(blocks, *block.Next)
	}

	// This is the last block
	return startID
}

// getSubstack2BlockID extracts the second substack block ID (for if-else)
func getSubstack2BlockID(block Block) string {
	if inputs, ok := block.Inputs["SUBSTACK2"].([]interface{}); ok && len(inputs) >= 2 {
		if id, ok := inputs[1].(string); ok {
			return id
		}
	}
	return ""
}

// extractInputValue recursively extracts the actual value from Scratch input format
// Handles formats like: [type, value] or [type, [inner_type, inner_value]]
func extractInputValue(input interface{}) string {
	switch v := input.(type) {
	case string:
		return v
	case []interface{}:
		if len(v) > 1 {
			// Try to extract from inner array
			if inner, ok := v[1].([]interface{}); ok {
				// This is a nested array like [type, [inner_type, value]]
				if len(inner) > 1 {
					// Return the inner value (the actual number/string)
					return fmt.Sprintf("%v", inner[1])
				}
			} else {
				// Simple array like [type, value]
				return fmt.Sprintf("%v", v[1])
			}
		}
		if len(v) > 0 {
			return fmt.Sprintf("%v", v[0])
		}
	default:
		return fmt.Sprintf("%v", v)
	}
	return ""
}

// getReferencedBlockLabel generates a label for a referenced block (used in inputs)
// This avoids infinite recursion by using a simpler approach and tracking visited blocks
func getReferencedBlockLabel(blockID string, block Block, translator *OpcodeTranslator, broadcasts map[string]string, blocks map[string]Block) string {
	return getReferencedBlockLabelRecursive(blockID, block, translator, broadcasts, blocks, make(map[string]bool))
}

func getReferencedBlockLabelRecursive(blockID string, block Block, translator *OpcodeTranslator, broadcasts map[string]string, blocks map[string]Block, visited map[string]bool) string {
	opcode := block.Opcode

	// Prevent infinite recursion
	if visited[blockID] {
		return "循环引用"
	}
	visited[blockID] = true

	// Get basic description from fields
	var parts []string
	for _, val := range block.Fields {
		var valStr string
		switch v := val.(type) {
		case string:
			valStr = v
		case []interface{}:
			if len(v) > 0 {
				if str, ok := v[0].(string); ok {
					valStr = str
				}
			}
		}
		if valStr != "" {
			// Translate special values like _mouse_, _random_, _myself_, etc.
			switch valStr {
			case "_mouse_":
				parts = append(parts, "鼠标指针")
			case "_random_":
				parts = append(parts, "随机位置")
			case "_myself_":
				parts = append(parts, "自己")
			default:
				if translated := translator.Translate(valStr); translated != "" && translated != valStr {
					parts = append(parts, translated)
				} else {
					parts = append(parts, valStr)
				}
			}
		}
	}

	// If this is a shadow block with only fields (like sensing_touchingobjectmenu),
	// and has no inputs, just return the field value directly
	if len(block.Inputs) == 0 && len(parts) > 0 {
		// This is a simple value selector, return the first field value
		return parts[0]
	}

	// Get values from inputs (for sensing blocks, etc.)
	if strings.HasPrefix(opcode, "operator") || strings.HasPrefix(opcode, "operators") {
		for _, key := range getOrderedOperatorKeys(opcode, block.Inputs) {
			if input, exists := block.Inputs[key]; exists {
				inputValue := resolveInputDisplay(input, translator, broadcasts, blocks, visited)
				if inputValue != "" {
					parts = append(parts, inputValue)
				}
			}
		}
	} else {
		for _, input := range block.Inputs {
			inputValue := resolveInputDisplay(input, translator, broadcasts, blocks, visited)
			if inputValue != "" {
				parts = append(parts, inputValue)
			}
		}
	}

	// Get translation
	chineseLabel := translator.Translate(opcode)
	if chineseLabel == "" || chineseLabel == strings.ToUpper(strings.ReplaceAll(opcode, ".", "_")) {
		// No translation, return opcode with parts
		if len(parts) > 0 {
			return fmt.Sprintf("%s %s", opcode, strings.Join(parts, " "))
		}
		return opcode
	}

	// Replace placeholders
	if len(parts) > 0 {
		result := chineseLabel
		for i, val := range parts {
			result = strings.ReplaceAll(result, fmt.Sprintf("%%%d", i+1), val)
		}
		return result
	}

	return chineseLabel
}

func resolveInputDisplay(input interface{}, translator *OpcodeTranslator, broadcasts map[string]string, blocks map[string]Block, visited map[string]bool) string {
	switch v := input.(type) {
	case []interface{}:
		if len(v) > 1 {
			if refBlockID, ok := v[1].(string); ok {
				if referencedBlock, exists := blocks[refBlockID]; exists {
					return getReferencedBlockLabelRecursive(refBlockID, referencedBlock, translator, broadcasts, blocks, visited)
				}
				return refBlockID
			}
		}
		return extractInputValue(v)
	default:
		return extractInputValue(v)
	}
}

func getOrderedOperatorKeys(opcode string, inputs map[string]interface{}) []string {
	var ordered []string
	preferredGroups := [][]string{
		{"OPERAND1", "OPERAND2", "OPERAND3"},
		{"NUM1", "NUM2", "NUM3"},
		{"STRING1", "STRING2"},
		{"FROM", "TO"},
		{"A", "B"},
	}

	added := make(map[string]bool)
	for _, group := range preferredGroups {
		for _, key := range group {
			if _, exists := inputs[key]; exists && !added[key] {
				ordered = append(ordered, key)
				added[key] = true
			}
		}
	}

	var leftovers []string
	for key := range inputs {
		if !added[key] {
			leftovers = append(leftovers, key)
		}
	}
	sort.Strings(leftovers)
	ordered = append(ordered, leftovers...)

	return ordered
}

// GetBlockLabel generates a human-readable label for a block
func GetBlockLabel(block Block, translator *OpcodeTranslator, broadcasts map[string]string, blocks map[string]Block) string {
	opcode := block.Opcode

	// Extract readable name from opcode
	parts := strings.Split(opcode, "_")
	var action string
	if len(parts) >= 2 {
		action = strings.Join(parts[1:], "_")
	} else {
		return opcode
	}

	// Get fields for more context
	var fieldVals []string
	for key, val := range block.Fields {
		// Special handling for BROADCAST_INPUT
		if key == "BROADCAST_INPUT" {
			switch v := val.(type) {
			case []interface{}:
				// Format: [display_name, broadcast_id]
				if len(v) >= 2 {
					if id, ok := v[1].(string); ok {
						// Try to find the broadcast name using the ID
						if name, exists := broadcasts[id]; exists {
							fieldVals = append(fieldVals, name)
						} else if len(v) > 0 {
							// Fallback to display name if ID lookup fails
							if displayName, ok := v[0].(string); ok {
								fieldVals = append(fieldVals, displayName)
							}
						}
					}
				}
			}
			continue
		}

		var valStr string
		switch v := val.(type) {
		case string:
			valStr = v
		case []interface{}:
			// Fields in Scratch are usually [display_value, id]
			if len(v) > 0 {
				if str, ok := v[0].(string); ok {
					valStr = str
				} else {
					valStr = fmt.Sprintf("%v", v[0])
				}
			}
		default:
			valStr = fmt.Sprintf("%v", v)
		}
		if valStr != "" {
			// Translate special values like _mouse_, _random_, _myself_, etc.
			switch valStr {
			case "_mouse_":
				fieldVals = append(fieldVals, "鼠标指针")
			case "_random_":
				fieldVals = append(fieldVals, "随机位置")
			case "_myself_":
				fieldVals = append(fieldVals, "自己")
			case "left-right":
				fieldVals = append(fieldVals, "左右旋转")
			default:
				if translated := translator.Translate(valStr); translated != "" && translated != valStr {
					fieldVals = append(fieldVals, translated)
				} else {
					fieldVals = append(fieldVals, valStr)
				}
			}
		}
	}

	// Special handling for motion_gotoxy - needs ordered X and Y values
	if opcode == "motion_gotoxy" {
		for _, key := range []string{"X", "Y"} {
			if input, exists := block.Inputs[key]; exists {
				value := extractInputValue(input)
				fieldVals = append(fieldVals, value)
			}
		}
	} else {
		// Also get input values
		for key, input := range block.Inputs {
			// Skip SUBSTACK input for control blocks (it's the loop body, not a parameter)
			if key == "SUBSTACK" || key == "SUBSTACK2" {
				continue
			}
			// Special handling for BROADCAST_INPUT
			if key == "BROADCAST_INPUT" {
				switch v := input.(type) {
				case []interface{}:
					if len(v) > 1 {
						// Format: [type, [11, "display_name", "broadcast_id"]]
						if nested, ok := v[1].([]interface{}); ok && len(nested) >= 3 {
							// Use the third element which is the broadcast ID
							if id, ok := nested[2].(string); ok {
								// Try to find the broadcast name using the ID
								if name, exists := broadcasts[id]; exists {
									fieldVals = append(fieldVals, name)
								} else if len(nested) > 1 {
									// Fallback to display name if ID lookup fails
									if displayName, ok := nested[1].(string); ok {
										fieldVals = append(fieldVals, displayName)
									}
								}
							}
						} else if nested, ok := v[1].([]interface{}); ok && len(nested) >= 2 {
							// If only two elements, use the second one as display name
							if displayName, ok := nested[1].(string); ok {
								fieldVals = append(fieldVals, displayName)
							}
						}
					}
				}
				continue
			}

			switch v := input.(type) {
			case []interface{}:
				if len(v) > 1 {
					// Check if the second element is a block ID reference
					if blockID, ok := v[1].(string); ok {
						// Try to resolve the referenced block
						if referencedBlock, exists := blocks[blockID]; exists {
							// Get a simplified label for the referenced block to avoid recursion
							refLabel := getReferencedBlockLabel(blockID, referencedBlock, translator, broadcasts, blocks)
							if refLabel != "" {
								fieldVals = append(fieldVals, refLabel)
							} else {
								// Fallback: get the field value from the referenced block
								var refValue string
								for _, fieldVal := range referencedBlock.Fields {
									switch fv := fieldVal.(type) {
									case string:
										refValue = fv
									case []interface{}:
										// Handle array like ["_mouse_"]
										if len(fv) > 0 {
											if str, ok := fv[0].(string); ok {
												refValue = str
											}
										}
									}
									break // Only take the first field value
								}
								if refValue != "" {
									// Translate special values to Chinese
									switch refValue {
									case "_mouse_":
										refValue = "鼠标指针"
									case "_random_":
										refValue = "随机位置"
									case "_myself_":
										refValue = "自己"
									}
									fieldVals = append(fieldVals, refValue)
								} else {
									fieldVals = append(fieldVals, blockID)
								}
							}
						} else {
							// Not a block reference, just a string value
							fieldVals = append(fieldVals, blockID)
						}
					} else if str, ok := v[1].([]interface{}); ok && len(str) > 0 {
						// This is a nested array, use extractInputValue
						fieldVals = append(fieldVals, extractInputValue(v))
					} else {
						fieldVals = append(fieldVals, extractInputValue(v[1]))
					}
				} else {
					// Simple input value
					fieldVals = append(fieldVals, extractInputValue(v))
				}
			}
		}
	}

	// Build label
	label := action
	if len(fieldVals) > 0 {
		label += ": " + strings.Join(fieldVals, ", ")
	}

	// Translate field values for specific opcodes
	if opcode == "looks_gotofrontback" && len(fieldVals) > 0 {
		for i, val := range fieldVals {
			switch val {
			case "front":
				fieldVals[i] = translator.Translate("LOOKS_GOTOFRONTBACK_FRONT")
			case "back":
				fieldVals[i] = translator.Translate("LOOKS_GOTOFRONTBACK_BACK")
			}
		}
	}

	// Use translator to get Chinese label
	chineseLabel := translator.Translate(opcode)

	// Add field values if available
	if len(fieldVals) > 0 && chineseLabel != "" {
		// Replace placeholder %1, %2, etc. with actual values
		result := chineseLabel
		for i, val := range fieldVals {
			result = strings.ReplaceAll(result, fmt.Sprintf("%%%d", i+1), val)
		}
		return result
	}

	// If no translation found, use the english label
	if chineseLabel == "" || chineseLabel == opcode {
		// Fallback to showing key fields
		if len(fieldVals) > 0 {
			return action + ": " + strings.Join(fieldVals, ", ")
		}
		return action
	}

	return chineseLabel
}

// getNodeShape returns the appropriate Mermaid node shape based on opcode type
// Returns start and close markers
func getNodeShape(opcode string) (string, string) {
	// Decision blocks (conditionals) - use diamond shape
	if strings.Contains(opcode, "control_if") || strings.Contains(opcode, "operator") {
		return "{ ", " }"
	}

	// Event blocks - use round shape
	if strings.HasPrefix(opcode, "event_") {
		return "( ", ")"
	}

	// Broadcast and stop blocks - use round shape
	if strings.Contains(opcode, "broadcast") || strings.Contains(opcode, "stop") {
		return "( ", ")"
	}

	// Regular action blocks - use round shape
	return "( ", ")"
}
