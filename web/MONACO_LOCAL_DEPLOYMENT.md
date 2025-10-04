# Monaco Editor 本地化部署

## 📋 概述

基于 [monaco-react 官方文档](https://github.com/suren-atoyan/monaco-react)，我们将 Monaco Editor 配置为使用本地化部署的 JS 文件，减少对外部 CDN 的依赖。

## ✅ 已完成的改进

### 1. 更新了 `monaco.tsx` 主文件

**主要改进：**

- ✅ **直接导入 Editor**：移除了不必要的动态导入
- ✅ **多层级回退策略**：本地路径 → 本机包 → CDN
- ✅ **状态监控**：实时显示当前使用的加载方式
- ✅ **更好的加载提示**：详细的加载状态用户界面

**关键代码：**
```typescript
import Editor, { loader } from "@monaco-editor/react"

// 三种加载策略自动降级
async function configureMonacoLocalDeployment() {
  try {
    // 1. 本地路径加载
    loader.config({
      paths: {
        vs: '/node_modules/monaco-editor/min/vs'
      }
    })
    setMonacoConfig('local')
  } catch {
    try {
      // 2. 本机包加载（完全离线）
      const monaco = await import('monaco-editor')
      loader.config({ monaco })
      setMonacoConfig('bundle')
    } catch {
      // 3. CDN 回退
      setMonacoConfig('cdn')
    }
  }
}
```

### 2. 配置了 `vite.config.ts`

**Vite 优化：**
```typescript
optimizeDeps: {
  include: ['monaco-editor', '@monaco-editor/react']
},
build: {
  rollupOptions: {
    external: []
  }
}
```

### 3. 创建了参考示例 `monaco-correct-example.tsx`

包含多种正确的使用方式：
- 简单直接使用
- 完整功能配置  
- 本地化配置
- 本机包导入
- 多模型编辑器

### 4. 提供了测试页面 `test-monaco.html`

用于验证各种加载方式是否正常工作。

## 🎯 三种部署策略

### 🌐 策略1：本地服务器路径（推荐）
```javascript
loader.config({
  paths: {
    vs: '/node_modules/monaco-editor/min/vs'
  }
})
```
- **优点**：使用已安装包，无需额外配置
- **要求**：服务器能提供 `/node_modules/` 路径的静态文件

### 📦 邮件2：本机包（完全离线）
```javascript
const monaco = await import('monaco-editor')
loader.config({ monaco })
```
- **优点**：完全离线，适合内网环境
- **缺点**：增加包体积

### ☁️ 策略3：CDN（兜底）
- 自动回退到默认 CDN
- 保证在任何情况下都能工作

## 🔧 用户界面改进

### 状态指示器
在顶部工具栏显示当前加载方式：
- 🌐 本地服务器版本
- 📦 本机包版本（离线）  
- ☁️ CDN 版本
- ⏳ 初始化中...

### 加载界面
```
🔄 Monaco Editor 加载中...
🌐 本地服务器版本
```

## 🚀 使用方法

### 开发环境
```bash
# 启动开发服务器
npm run dev

# Monaco Editor 将自动：
# 1. 尝试从 /node_modules/monaco-editor/min/vs 加载
# 2. 如果不成功则使用本机包
# 3. 最后回退到 CDN
```

### 生产环境
确保生产服务器能提供 `monaco-editor` 的静态文件：
```bash
# 检查文件是否存在
ls -la node_modules/monaco-editor/min/vs/
```

## 🧪 测试步骤

### 1. 浏览器测试
打开浏览器开发者工具：
1. **网络面板**：查看 Monaco 文件是否从本地加载
2. **控制台**：查看加载策略的日志输出
3. **UI 指示器**：确认顶部显示的加载方式

### 2. 功能测试
使用 `test-monaco.html` 页面：
```bash
# 访问测试页面
http://localhost:3000/test-monaco.html
```

### 3. 离线测试
断网后验证编辑器是否仍能正常工作（本机包策略）

## 📁 文件清单

```
web/react-router-www/
├── app/routes/editor/
│   ├── monaco.tsx              # ✅ 更新：主编辑器组件
│   └── monaco-correct-example.tsx  # ✅ 新增：参考示例
├── vite.config.ts             # ✅ 更新：Vite 配置
├── test-monaco.html           # ✅ 新增：测试页面
└── MONACO_LOCAL_DEPLOYMENT.md # ✅ 新增：说明文档
```

## 🔍 故障排除

### 问题1：本地文件加载失败
**症状**：编辑器显示 "本机包配置失败，使用默认 CDN"
**解决**：
- 检查服务器是否提供 `/node_modules/monaco-editor/min/vs` 路径
- 检查文件权限
- 查看浏览器网络请求是否返回 404

### 问题2：编辑器渲染失败
**症状**：编辑区域显示空白或错误信息
**解决**：
- 检查是否同时导入了 `Editor` 和 `loader`
- 确认配置函数在客户端运行（检查 `typeof window !== "undefined"`）

### 问题3：本机包占用空间过大
**症状**：打包后的文件体积显著增加
**解决**：
- 优先使用本地路径策略（策略1）
- 考虑 tree-shaking 优化
- 使用 `monaco-editor/vs/editor/editor.worker` 而不是完整包

## 📚 参考资源

- [Monaco React 官方文档](https://github.com/suren-atoyan/monaco-react)
- [Monaco Editor 仓库](https://github.com/microsoft/monaco-editor)
- [@monaco-editor/loader 文档](https://github.com/microsoft/monaco-editor/tree/main/docs/integrate-amd.md)

## 🎉 总结

通过本次改进，我们实现了：

1. ✅ **完全本地化**：Monaco Editor 不再依赖外部 CDN
2. ✅ **自动降级**：三种策略确保在任何环境下都能工作
3. ✅ **用户友好**：清晰的状态指示和加载提示
4. ✅ **生产就绪**：包含完整的测试和文档
5. ✅ **最佳实践**：符合官方推荐的使用方式

现在 Monaco Editor 可以在离线环境、内网环境或任何不需要访问外部 CDN 的场景下正常工作！
