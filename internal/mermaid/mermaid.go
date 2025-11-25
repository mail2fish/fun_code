package mermaid

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

var mermaidLabelReplacer = strings.NewReplacer(
	"[", "&#91;",
	"]", "&#93;",
	"(", "&#40;",
	")", "&#41;",
	"{", "&#123;",
	"}", "&#125;",
	"<", "&lt;",
	">", "&gt;",
	"|", "&#124;",
	"\"", "&quot;",
	"'", "&#39;",
	"\n", " ",
	"\r", " ",
	"\t", " ",
)

func sanitizeMermaidLabel(label string) string {
	return mermaidLabelReplacer.Replace(label)
}

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
	builder.WriteString(sanitizeMermaidLabel(rootName))
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
		builder.WriteString(fmt.Sprintf("    Start --> %s[%s]\n", branchHash, sanitizeMermaidLabel(target.Name)))

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
	generateBlockFlowWithTarget(builder, blocks, blockID, prefix, depth, visited, idMapper, translator, broadcasts, "")
}

// generateBlockFlowWithTarget recursively generates the flowchart for a block chain with a target end node
func generateBlockFlowWithTarget(builder *strings.Builder, blocks map[string]Block, blockID string, prefix string, depth int, visited map[string]bool, idMapper *IDMapper, translator *OpcodeTranslator, broadcasts map[string]string, targetEndNode string) {
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
	builder.WriteString(fmt.Sprintf("    %s%s%s%s\n", nodeName, nodeShape, sanitizeMermaidLabel(label), nodeShapeClose))

	// Handle control blocks with substacks
	if _, handled := HandleControlBlockWithTarget(builder, blocks, block, nodeName, prefix, blockID, depth, visited, idMapper, translator, broadcasts, targetEndNode); handled {
		return
	}

	// Follow next block
	if block.Next != nil {
		nextSafeID := idMapper.GetSafeID(*block.Next)
		nextNodeName := fmt.Sprintf("%s_%s", prefix, nextSafeID)
		builder.WriteString(fmt.Sprintf("    %s --> %s\n", nodeName, nextNodeName))
		generateBlockFlowWithTarget(builder, blocks, *block.Next, prefix, depth+1, visited, idMapper, translator, broadcasts, targetEndNode)
	} else if strings.HasPrefix(block.Opcode, "event_") {
		// Event blocks might be standalone
		builder.WriteString(fmt.Sprintf("    %s --> %s_end[结束]\n", nodeName, nodeName))
	} else if targetEndNode != "" {
		// If no next block but target end node is specified, connect to it
		builder.WriteString(fmt.Sprintf("    %s --> %s\n", nodeName, targetEndNode))
	}
}

// HandleControlBlock handles special control blocks (loops, conditionals)
func HandleControlBlock(builder *strings.Builder, blocks map[string]Block, block Block, nodeName, prefix, blockID string, depth int, visited map[string]bool, idMapper *IDMapper, translator *OpcodeTranslator, broadcasts map[string]string) (bool, bool) {
	return HandleControlBlockWithTarget(builder, blocks, block, nodeName, prefix, blockID, depth, visited, idMapper, translator, broadcasts, "")
}

// HandleControlBlockWithTarget handles special control blocks with a target end node
func HandleControlBlockWithTarget(builder *strings.Builder, blocks map[string]Block, block Block, nodeName, prefix, blockID string, depth int, visited map[string]bool, idMapper *IDMapper, translator *OpcodeTranslator, broadcasts map[string]string, targetEndNode string) (bool, bool) {

	// Handle FOREVER loop
	if block.Opcode == "control_forever" {
		loopContinueNode := fmt.Sprintf("%s_loop_continue", nodeName)
		builder.WriteString(fmt.Sprintf("    %s[继续循环]\n", loopContinueNode))

		if substack := getSubstackBlockID(block); substack != "" {
			substackSafeID := idMapper.GetSafeID(substack)
			substackNode := fmt.Sprintf("%s_%s", prefix, substackSafeID)
			builder.WriteString(fmt.Sprintf("    %s --> %s\n", nodeName, substackNode))

			// Track visited blocks for this loop to avoid cycles in nested structures
			loopVisited := make(map[string]bool)
			for k, v := range visited {
				loopVisited[k] = v
			}

			// Generate the entire substack chain, forcing it to end at the loop continue node
			generateBlockFlowWithTarget(builder, blocks, substack, prefix, depth+1, loopVisited, idMapper, translator, broadcasts, loopContinueNode)
		} else {
			// Empty loop body still connects through the loop continue node
			builder.WriteString(fmt.Sprintf("    %s --> %s\n", nodeName, loopContinueNode))
		}

		// Loop continue node connects back to the forever node
		builder.WriteString(fmt.Sprintf("    %s --> %s\n", loopContinueNode, nodeName))
		return true, true
	}

	// Handle IF block
	if block.Opcode == "control_if" {
		conditionEndNode := fmt.Sprintf("%s_cond_end", nodeName)
		builder.WriteString(fmt.Sprintf("    %s[条件结束]\n", conditionEndNode))

		if substack := getSubstackBlockID(block); substack != "" {
			substackSafeID := idMapper.GetSafeID(substack)
			substackNode := fmt.Sprintf("%s_%s", prefix, substackSafeID)
			builder.WriteString(fmt.Sprintf("    %s -->|是| %s\n", nodeName, substackNode))
			generateBlockFlowWithTarget(builder, blocks, substack, prefix, depth+1, visited, idMapper, translator, broadcasts, conditionEndNode)

			if lastBlockID := findLastBlockInChain(blocks, substack); lastBlockID == "" {
				builder.WriteString(fmt.Sprintf("    %s --> %s\n", substackNode, conditionEndNode))
			}
		} else {
			builder.WriteString(fmt.Sprintf("    %s -->|是| %s\n", nodeName, conditionEndNode))
		}

		builder.WriteString(fmt.Sprintf("    %s -->|否| %s\n", nodeName, conditionEndNode))

		connectEndNodeToNext(builder, conditionEndNode, block, blockID, prefix, blocks, idMapper, translator, broadcasts, depth, visited, targetEndNode)
		return true, true
	}

	// Handle IF-ELSE block
	if block.Opcode == "control_if_else" {
		conditionEndNode := fmt.Sprintf("%s_cond_end", nodeName)
		builder.WriteString(fmt.Sprintf("    %s[条件结束]\n", conditionEndNode))

		if substack1 := getSubstackBlockID(block); substack1 != "" {
			substack1SafeID := idMapper.GetSafeID(substack1)
			substackNode := fmt.Sprintf("%s_%s", prefix, substack1SafeID)
			builder.WriteString(fmt.Sprintf("    %s -->|是| %s\n", nodeName, substackNode))
			generateBlockFlowWithTarget(builder, blocks, substack1, prefix, depth+1, visited, idMapper, translator, broadcasts, conditionEndNode)

			if lastBlockID := findLastBlockInChain(blocks, substack1); lastBlockID == "" {
				builder.WriteString(fmt.Sprintf("    %s --> %s\n", substackNode, conditionEndNode))
			}
		} else {
			builder.WriteString(fmt.Sprintf("    %s -->|是| %s\n", nodeName, conditionEndNode))
		}

		if substack2 := getSubstack2BlockID(block); substack2 != "" {
			substack2SafeID := idMapper.GetSafeID(substack2)
			substackNode := fmt.Sprintf("%s_%s", prefix, substack2SafeID)
			builder.WriteString(fmt.Sprintf("    %s -->|否| %s\n", nodeName, substackNode))
			generateBlockFlowWithTarget(builder, blocks, substack2, prefix, depth+1, visited, idMapper, translator, broadcasts, conditionEndNode)

			if lastBlockID := findLastBlockInChain(blocks, substack2); lastBlockID == "" {
				builder.WriteString(fmt.Sprintf("    %s --> %s\n", substackNode, conditionEndNode))
			}
		} else {
			builder.WriteString(fmt.Sprintf("    %s -->|否| %s\n", nodeName, conditionEndNode))
		}

		connectEndNodeToNext(builder, conditionEndNode, block, blockID, prefix, blocks, idMapper, translator, broadcasts, depth, visited, targetEndNode)
		return true, true
	}

	// Handle REPEAT loop
	if block.Opcode == "control_repeat" || block.Opcode == "control_repeat_until" {
		loopEndNode := fmt.Sprintf("%s_loop_end", nodeName)
		builder.WriteString(fmt.Sprintf("    %s[循环结束]\n", loopEndNode))

		if substack := getSubstackBlockID(block); substack != "" {
			substackSafeID := idMapper.GetSafeID(substack)
			substackNode := fmt.Sprintf("%s_%s", prefix, substackSafeID)
			builder.WriteString(fmt.Sprintf("    %s -->|成立| %s\n", nodeName, substackNode))

			loopVisited := make(map[string]bool)
			for k, v := range visited {
				loopVisited[k] = v
			}

			if _, exists := blocks[substack]; exists {
				generateBlockFlowWithTarget(builder, blocks, substack, prefix, depth+1, loopVisited, idMapper, translator, broadcasts, loopEndNode)
			} else {
				builder.WriteString(fmt.Sprintf("    %s --> %s\n", substackNode, loopEndNode))
			}
		} else {
			builder.WriteString(fmt.Sprintf("    %s -->|成立| %s\n", nodeName, loopEndNode))
		}

		builder.WriteString(fmt.Sprintf("    %s -->|不成立| %s\n", nodeName, loopEndNode))

		connectEndNodeToNext(builder, loopEndNode, block, blockID, prefix, blocks, idMapper, translator, broadcasts, depth, visited, targetEndNode)
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

var keyOptionTranslations = map[string]string{
	"space":       "空格",
	"any":         "任意键",
	"left arrow":  "左箭头",
	"right arrow": "右箭头",
	"up arrow":    "上箭头",
	"down arrow":  "下箭头",
}

func translateFieldValue(valStr string, translator *OpcodeTranslator) string {
	switch valStr {
	case "_mouse_":
		return "鼠标指针"
	case "_random_":
		return "随机位置"
	case "_myself_":
		return "自己"
	case "left-right":
		return "左右旋转"
	}
	if translated, ok := keyOptionTranslations[strings.ToLower(valStr)]; ok {
		return translated
	}
	if translated := translator.Translate(valStr); translated != "" && translated != valStr {
		return translated
	}
	return valStr
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
			parts = append(parts, translateFieldValue(valStr, translator))
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

	// Special handling for control_if and control_if_else - extract CONDITION first
	if opcode == "control_if" || opcode == "control_if_else" {
		var conditionLabel string
		if conditionInput, exists := block.Inputs["CONDITION"]; exists {
			conditionLabel = resolveInputDisplay(conditionInput, translator, broadcasts, blocks, make(map[string]bool))
			if conditionLabel == "" {
				conditionLabel = extractInputValue(conditionInput)
			}
		}

		// Get translation
		chineseLabel := translator.Translate(opcode)
		// Check if translation exists by checking if it contains %1 placeholder or is different from simplified opcode
		simplifiedOpcode := opcode
		if parts := strings.Split(opcode, "_"); len(parts) >= 2 {
			simplifiedOpcode = strings.Join(parts[1:], "_")
		}

		// If translation exists and is different from simplified opcode, use it
		if chineseLabel != "" && chineseLabel != simplifiedOpcode && strings.Contains(chineseLabel, "%1") {
			// Replace placeholder %1 with condition
			if conditionLabel != "" {
				result := strings.ReplaceAll(chineseLabel, "%1", conditionLabel)
				return result
			}
			// If no condition, return translation without placeholder
			return strings.ReplaceAll(chineseLabel, "%1", "")
		}

		// Fallback if no translation or condition exists
		if conditionLabel != "" {
			return fmt.Sprintf("如果 %s", conditionLabel)
		}
		// Last fallback
		if chineseLabel != "" && chineseLabel != simplifiedOpcode {
			return chineseLabel
		}
		return opcode
	}

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
			fieldVals = append(fieldVals, translateFieldValue(valStr, translator))
		}
	}

	// Special handling for motion_gotoxy - needs ordered X and Y values
	if opcode == "motion_gotoxy" {
		for _, key := range []string{"X", "Y"} {
			if input, exists := block.Inputs[key]; exists {
				value := resolveInputDisplay(input, translator, broadcasts, blocks, make(map[string]bool))
				if value == "" {
					value = extractInputValue(input)
				}
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
									fieldVals = append(fieldVals, translateFieldValue(refValue, translator))
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

func findNearestLoopAncestorNode(block Block, blocks map[string]Block, idMapper *IDMapper, prefix string) string {
	visited := make(map[string]bool)
	parentPtr := block.Parent
	for parentPtr != nil {
		parentID := *parentPtr
		if visited[parentID] {
			break
		}
		visited[parentID] = true
		parentBlock, exists := blocks[parentID]
		if !exists {
			break
		}
		if parentBlock.Opcode == "control_forever" || parentBlock.Opcode == "control_repeat" || parentBlock.Opcode == "control_repeat_until" {
			parentSafeID := idMapper.GetSafeID(parentID)
			return fmt.Sprintf("%s_%s", prefix, parentSafeID)
		}
		parentPtr = parentBlock.Parent
	}
	return ""
}

func connectEndNodeToNext(builder *strings.Builder, endNode string, block Block, blockID string, prefix string, blocks map[string]Block, idMapper *IDMapper, translator *OpcodeTranslator, broadcasts map[string]string, depth int, visited map[string]bool, targetEndNode string) {
	if targetEndNode != "" {
		// If target end node is specified, connect to it instead of finding parent
		builder.WriteString(fmt.Sprintf("    %s --> %s\n", endNode, targetEndNode))
		return
	}

	if block.Next != nil {
		nextSafeID := idMapper.GetSafeID(*block.Next)
		nextNodeName := fmt.Sprintf("%s_%s", prefix, nextSafeID)
		builder.WriteString(fmt.Sprintf("    %s --> %s\n", endNode, nextNodeName))
		generateBlockFlow(builder, blocks, *block.Next, prefix, depth+1, visited, idMapper, translator, broadcasts)
		return
	}

	if parentTarget := findParentExitTarget(block, blockID, prefix, blocks, idMapper); parentTarget != "" {
		builder.WriteString(fmt.Sprintf("    %s --> %s\n", endNode, parentTarget))
		return
	}

	endNodeName := fmt.Sprintf("%s_end", endNode)
	builder.WriteString(fmt.Sprintf("    %s --> %s[结束]\n", endNode, endNodeName))
}

func findParentExitTarget(block Block, blockID string, prefix string, blocks map[string]Block, idMapper *IDMapper) string {
	parentPtr := block.Parent
	visited := make(map[string]bool)
	for parentPtr != nil {
		parentID := *parentPtr
		if visited[parentID] {
			break
		}
		visited[parentID] = true

		parentBlock, exists := blocks[parentID]
		if !exists {
			break
		}

		parentNodeName := fmt.Sprintf("%s_%s", prefix, idMapper.GetSafeID(parentID))
		if isControlBlockWithEnd(parentBlock.Opcode) {
			return getControlBlockEndNodeName(parentBlock.Opcode, parentNodeName)
		}

		if parentBlock.Next != nil {
			nextID := *parentBlock.Next
			// If parent's next points to the current block, skip to avoid self-loop
			if nextID == blockID {
				parentPtr = parentBlock.Parent
				continue
			}
			nextSafeID := idMapper.GetSafeID(nextID)
			return fmt.Sprintf("%s_%s", prefix, nextSafeID)
		}

		parentPtr = parentBlock.Parent
	}
	return ""
}

func isControlBlockWithEnd(opcode string) bool {
	switch opcode {
	case "control_if", "control_if_else", "control_repeat", "control_repeat_until":
		return true
	default:
		return false
	}
}

func getControlBlockEndNodeName(opcode, nodeName string) string {
	switch opcode {
	case "control_if", "control_if_else":
		return fmt.Sprintf("%s_cond_end", nodeName)
	case "control_repeat", "control_repeat_until":
		return fmt.Sprintf("%s_loop_end", nodeName)
	default:
		return ""
	}
}
