import * as React from "react"
import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"
import { useParams, useNavigate } from "react-router"
import Editor, { loader } from "@monaco-editor/react"
import { useUser } from "~/hooks/use-user"
import { Home, Code2 } from "lucide-react"

// Python语言配置函数
function configurePythonLanguage(monaco: any) {
  // 注册Python语言
  monaco.languages.register({ id: 'python' })

  // 配置Python语言特性
  monaco.languages.setLanguageConfiguration('python', {
    comments: {
      lineComment: '#',
      blockComment: ['"""', '"""']
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '"""', close: '"""' },
      { open: "'''", close: "'''" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    folding: {
      offSide: true,
      markers: {
        start: new RegExp("^\\s*#region\\b"),
        end: new RegExp("^\\s*#endregion\\b")
      }
    }
  })

  // 注册Python代码片段
  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: (model: any, position: any) => {
        // 动态收集当前文件中定义的函数与类方法，作为补全项
      const codeText: string = model?.getValue?.() || ''
      const dynamic: any[] = []

      try {
        // 普通函数: def func_name(param1, param2):
        const funcRegex = /^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/gm
        let m: RegExpExecArray | null
        while ((m = funcRegex.exec(codeText))) {
          const name = m[1]
          const paramsRaw = (m[2] || '').trim()
          const paramsList = paramsRaw
            ? paramsRaw.split(',').map(s => s.trim()).filter(Boolean)
            : []
          const snippetParams = paramsList.length
            ? paramsList.map((p, idx) => `
${'${'}${idx + 1}:${p.replace(/\$/g, '')}${'}'}`.replace(/\n/g, '')).join(', ')
            : ''
          dynamic.push({
            label: name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${name}(${snippetParams})`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '来自当前文件的函数定义',
          })
        }

        // 类与方法: class ClassName:\n    def method(self, ...):
        const classRegex = /^\s*class\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*:|^\s*class\s+([A-Za-z_]\w*)\s*:\s*$/gm
        // 预先获取行数组以便限定类作用域
        const lines = codeText.split('\n')
        let classMatch: RegExpExecArray | null
        while ((classMatch = classRegex.exec(codeText))) {
          const className = (classMatch[1] || classMatch[2] || '').trim()
          if (!className) continue
          // 从类定义所在行向下，找缩进的方法定义
          const startIdx = codeText.slice(0, classMatch.index).split('\n').length - 1
          const indentMatch = lines[startIdx]?.match(/^(\s*)class\b/)
          const classIndent = indentMatch ? indentMatch[1] : lines[startIdx]?.match(/^(\s*)/)?.[1] || ''
          for (let i = startIdx + 1; i < lines.length; i++) {
            const line = lines[i]
            if (!line.trim()) continue
            // 类体在更深缩进层级，遇到比 classIndent 更浅的缩进则结束
            const currentIndent = (line.match(/^(\s*)/)?.[1] || '')
            if (currentIndent.length <= classIndent.length) break
            const methodMatch = line.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/)
            if (methodMatch) {
              const methodName = methodMatch[1]
              const paramsRaw = (methodMatch[2] || '').trim()
              const paramsList = paramsRaw
                ? paramsRaw.split(',').map(s => s.trim()).filter(Boolean)
                : []
              // 过滤掉 self/cls
              const cleanedParams = paramsList.filter(p => !/^self\b|^cls\b/.test(p))
              const snippetParams = cleanedParams.length
                ? cleanedParams.map((p, idx) => `
${'${'}${idx + 1}:${p.replace(/\$/g, '')}${'}'}`.replace(/\n/g, '')).join(', ')
                : ''
              dynamic.push({
                label: `${className}.${methodName}`,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: `${className}.${methodName}(${snippetParams})`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: '来自当前文件的类方法',
              })
            }
          }
        }
      } catch (_) {}

      const suggestions = [
        // 基础Python语法
        {
          label: 'print',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'print(${1:message})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '打印输出到控制台'
        },
        {
          label: 'if',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'if ${1:condition}:\n    ${2:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '条件语句'
        },
        {
          label: 'for',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'for ${1:item} in ${2:iterable}:\n    ${3:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'for循环'
        },
        {
          label: 'while',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'while ${1:condition}:\n    ${2:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'while循环'
        },
        {
          label: 'def',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'def ${1:function_name}(${2:parameters}):\n    """${3:docstring}"""\n    ${4:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '定义函数'
        },
        {
          label: 'class',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'class ${1:ClassName}:\n    """${2:docstring}"""\n    def __init__(self${3:, parameters}):\n        ${4:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '定义类'
        },
        {
          label: 'try',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}\nfinally:\n    ${5:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '异常处理'
        },
        {
          label: 'with',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'with ${1:expression} as ${2:variable}:\n    ${3:pass}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '上下文管理器'
        },
        {
          label: 'import',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'import ${1:module}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '导入模块'
        },
        {
          label: 'from',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'from ${1:module} import ${2:name}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '从模块导入'
        },

        // NumPy相关
        {
          label: 'np.array',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.array(${1:data})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '创建NumPy数组'
        },
        {
          label: 'np.linspace',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.linspace(${1:start}, ${2:stop}, ${3:num})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '创建线性间隔的数组'
        },
        {
          label: 'np.arange',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.arange(${1:start}, ${2:stop}, ${3:step})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '创建数值范围数组'
        },
        {
          label: 'np.zeros',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.zeros(${1:shape})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '创建零数组'
        },
        {
          label: 'np.ones',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.ones(${1:shape})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '创建一数组'
        },
        {
          label: 'np.random',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.random.${1:function}(${2:parameters})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'NumPy随机数生成'
        },

        // Matplotlib相关
        {
          label: 'plt.plot',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.plot(${1:x}, ${2:y}${3:, label="${4:label}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '绘制线图'
        },
        {
          label: 'plt.scatter',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.scatter(${1:x}, ${2:y}${3:, s=${4:20}, c=${5:"blue"})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '绘制散点图'
        },
        {
          label: 'plt.bar',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.bar(${1:x}, ${2:height}${3:, width=${4:0.8}})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '绘制柱状图'
        },
        {
          label: 'plt.hist',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.hist(${1:data}${2:, bins=${3:10}})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '绘制直方图'
        },
        {
          label: 'plt.figure',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.figure(figsize=(${1:width}, ${2:height}))',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '创建图形'
        },
        {
          label: 'plt.title',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.title("${1:title}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '设置图形标题'
        },
        {
          label: 'plt.xlabel',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.xlabel("${1:x_label}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '设置x轴标签'
        },
        {
          label: 'plt.ylabel',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.ylabel("${1:y_label}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '设置y轴标签'
        },
        {
          label: 'plt.grid',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.grid(${1:True})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '显示网格'
        },
        {
          label: 'plt.legend',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.legend()',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '显示图例'
        },
        {
          label: 'plt.show',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.show()',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '显示图形'
        },
        {
          label: 'plt.savefig',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'plt.savefig("${1:filename}.png"${2:, dpi=${3:300}, bbox_inches="tight"})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '保存图形'
        },

        // 常用数学函数
        {
          label: 'np.sin',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.sin(${1:x})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '正弦函数'
        },
        {
          label: 'np.cos',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.cos(${1:x})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '余弦函数'
        },
        {
          label: 'np.tan',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.tan(${1:x})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '正切函数'
        },
        {
          label: 'np.exp',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.exp(${1:x})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '指数函数'
        },
        {
          label: 'np.log',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.log(${1:x})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '自然对数'
        },
        {
          label: 'np.sqrt',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'np.sqrt(${1:x})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '平方根'
        },

        // 常用导入语句
        {
          label: 'import numpy as np',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'import numpy as np',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '导入NumPy库'
        },
        {
          label: 'import matplotlib.pyplot as plt',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'import matplotlib.pyplot as plt',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '导入Matplotlib绘图库'
        },
        {
          label: 'import pandas as pd',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'import pandas as pd',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '导入Pandas数据处理库'
        },
        {
          label: 'import seaborn as sns',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'import seaborn as sns',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '导入Seaborn统计绘图库'
        }
      ]

      return { suggestions: [...dynamic, ...suggestions] }
    }
  })

  // 注册悬停提示
  monaco.languages.registerHoverProvider('python', {
    provideHover: (model: any, position: any) => {
      const word = model.getWordAtPosition(position)
      if (!word) return null

      const hoverInfo: { [key: string]: string } = {
        'print': '打印函数：将值输出到标准输出流',
        'len': '长度函数：返回对象的长度或元素个数',
        'range': '范围函数：生成一个整数序列',
        'list': '列表函数：创建列表或转换其他类型为列表',
        'dict': '字典函数：创建字典或转换其他类型为字典',
        'str': '字符串函数：创建字符串或转换其他类型为字符串',
        'int': '整数函数：创建整数或转换其他类型为整数',
        'float': '浮点数函数：创建浮点数或转换其他类型为浮点数',
        'bool': '布尔函数：创建布尔值或转换其他类型为布尔值',
        'np': 'NumPy：Python科学计算的基础库',
        'plt': 'Matplotlib：Python绘图库',
        'pd': 'Pandas：Python数据分析库',
        'sns': 'Seaborn：基于Matplotlib的统计绘图库'
      }

      const info = hoverInfo[word.word]
      if (info) {
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [{ value: `**${word.word}**\n\n${info}` }]
        }
      }

      return null
    }
  })
}

// 调试检查面板组件（变量/输出 标签 + 搜索 + 复制）
function DebugInspector({
  pausedLine,
  locals,
  stdout,
}: {
  pausedLine: number | null
  locals: Record<string, string>
  stdout: string
}) {
  const [activeTab, setActiveTab] = React.useState<'vars' | 'stdout'>('vars')
  const [query, setQuery] = React.useState('')

  const filteredLocals = React.useMemo(() => {
    if (!query) return locals
    const q = query.toLowerCase()
    const entries = Object.entries(locals).filter(([k, v]) =>
      k.toLowerCase().includes(q) || String(v ?? '').toLowerCase().includes(q)
    )
    return Object.fromEntries(entries)
  }, [locals, query])

  const copyText = (text: string) => {
    try {
      navigator.clipboard.writeText(text)
      ;(window as any).toast?.success?.('已复制到剪贴板')
    } catch (_) {}
  }

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-900 shadow-sm">
      <div className="flex items-center gap-3 px-4 pt-3">
        <div className="text-sm font-semibold">调试状态 {pausedLine ? `(行 ${pausedLine})` : ''}</div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setActiveTab('vars')}
            className={`px-2.5 py-1 text-xs rounded-md border ${activeTab === 'vars' ? 'bg-white border-blue-300 text-blue-700' : 'bg-blue-100 border-blue-200 text-blue-800 hover:bg-blue-200'}`}
          >变量</button>
          <button
            onClick={() => setActiveTab('stdout')}
            className={`px-2.5 py-1 text-xs rounded-md border ${activeTab === 'stdout' ? 'bg-white border-blue-300 text-blue-700' : 'bg-blue-100 border-blue-200 text-blue-800 hover:bg-blue-200'}`}
          >输出</button>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="px-4 pb-3 flex items-center gap-2">
        {activeTab === 'vars' ? (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索变量名/值..."
              className="flex-1 px-3 py-1.5 text-sm rounded-md bg-white/80 border border-blue-200 placeholder:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={() => copyText(JSON.stringify(locals, null, 2))}
              className="px-2.5 py-1 text-xs rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"
            >复制变量JSON</button>
          </>
        ) : (
          <button
            onClick={() => copyText(stdout || '')}
            className="ml-auto px-2.5 py-1 text-xs rounded-md bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"
          >复制输出</button>
        )}
      </div>

      {/* 内容区 */}
      <div className="px-4 pb-4">
        {activeTab === 'vars' ? (
          Object.keys(filteredLocals).length ? (
            <div className="rounded-lg bg-white border border-blue-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-50 text-blue-800">
                    <th className="text-left px-3 py-2 font-semibold w-48">变量名</th>
                    <th className="text-left px-3 py-2 font-semibold">值</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(filteredLocals).map(([k, v]) => (
                    <tr key={k} className="border-t border-blue-100 hover:bg-blue-50/50">
                      <td className="px-3 py-1.5 align-top font-mono text-[11px] text-blue-900 break-all">{k}</td>
                      <td className="px-3 py-1.5 align-top font-mono text-[11px] text-blue-900 whitespace-pre-wrap break-words">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-blue-700/80">{query ? '没有匹配到变量' : '无变量'}</div>
          )
        ) : (
          <pre className="text-xs bg-white rounded-lg border border-blue-200 p-3 whitespace-pre-wrap text-blue-900">{stdout || '无输出'}</pre>
        )}
      </div>
    </div>
  )
}

export default function MonacoEditorPage() {
  const { programId: routeProgramId } = useParams()
  const navigate = useNavigate()
  const { userInfo } = useUser()
  const [monacoConfig, setMonacoConfig] = React.useState<'local' | 'bundle' | 'cdn' | 'loading'>('loading')
  const initialCode = [
    "# 仅用 print 输出一个有趣的小恐龙",
    "print(\"           __        \")",
    "print(\"          / _)_      \")",
    "print(\"   .-^^^-/ /         \")",
    "print(\"__/       /          \")",
    "print(\"<__.|_|-|_|  Roar!   \")",
    "print()",
    "print(\"欢迎来到 Fun Code，开动你的想象力吧！\")",
  ].join("\n")
  const [code, setCode] = React.useState<string>(initialCode)
  const [pyodide, setPyodide] = React.useState<any>(null)
  const [outputText, setOutputText] = React.useState<string>("")
  const [outputImage, setOutputImage] = React.useState<string>("")
  // 控制台分栏
  const [stdoutText, setStdoutText] = React.useState<string>("")
  const [stderrText, setStderrText] = React.useState<string>("")
  const [logsText, setLogsText] = React.useState<string>("")
  // 控制台选项卡：输出/错误/日志
  const [activeConsoleTab, setActiveConsoleTab] = React.useState<'out' | 'err' | 'log'>('out')
  const [running, setRunning] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [programName, setProgramName] = React.useState<string>("未命名程序")
  const [ownerName, setOwnerName] = React.useState<string>("")
  const [programId, setProgramId] = React.useState<number | null>(null)
  const [syntaxError, setSyntaxError] = React.useState<{ message: string; line?: number } | null>(null)
  const [runError, setRunError] = React.useState<{ message: string; line?: number } | null>(null)
  const outputRef = React.useRef<HTMLDivElement>(null)
  // 图形输出挂载点（Pixi + matplotlib）
  const gfxRootRef = React.useRef<HTMLDivElement>(null)
  const mplRootRef = React.useRef<HTMLDivElement>(null)
  const programType = "python"
  const editorRef = React.useRef<any>(null)
  const monacoRef = React.useRef<any>(null)
  // 记录编辑器鼠标监听的可清理句柄，避免重复绑定导致多次触发
  const mouseDownDisposeRef = React.useRef<any>(null)
  // 调试相关
  const [debugging, setDebugging] = React.useState(false)
  const [pausedLine, setPausedLine] = React.useState<number | null>(null)
  const [localsView, setLocalsView] = React.useState<string>("")
  const [breakpoints, setBreakpoints] = React.useState<Set<number>>(new Set())
  // 用 ref 保存装饰 ID，避免因闭包拿到旧 state 造成叠加
  const bpDecorationsRef = React.useRef<string[]>([])
  const currentLineDecorationsRef = React.useRef<string[]>([])
  // Pixi 可见性（用于折叠空白）
  const [pixiVisible, setPixiVisible] = React.useState<boolean>(false)
  // 图形输出交互
  const [isOutputSelected, setIsOutputSelected] = React.useState<boolean>(false)
  const [isOutputMaximized, setIsOutputMaximized] = React.useState<boolean>(false)
  const [overlayMounted, setOverlayMounted] = React.useState<boolean>(false)
  const fullscreenGfxRef = React.useRef<HTMLDivElement>(null)
  const fullscreenMplRef = React.useRef<HTMLDivElement>(null)
  // 定时保存相关状态
  const [lastSaveTime, setLastSaveTime] = React.useState<Date | null>(null)
  const [isAutoSaving, setIsAutoSaving] = React.useState<boolean>(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState<boolean>(false)
  const lastCodeRef = React.useRef<string>(initialCode)

  // 在最大化/还原时搬运 Pixi 画布与 Matplotlib DOM 节点，避免内容丢失
  React.useEffect(() => {
    const rebindPixiRoot = (el: HTMLElement | null) => {
      try {
        if (!el) return
        const w = el.clientWidth || 800
        const h = el.clientHeight || 480
        ;(window as any).GameAPI?.init?.(el, { width: w, height: h })
      } catch (_) {}
    }
    const moveAllChildren = (fromEl: HTMLElement | null, toEl: HTMLElement | null) => {
      if (!fromEl || !toEl) return
      try {
        // 清空目标容器
        while (toEl.firstChild) toEl.removeChild(toEl.firstChild)
        // 将源容器的子节点逐一搬运到目标（appendChild 会移动节点）
        const nodes: ChildNode[] = []
        fromEl.childNodes.forEach((n) => nodes.push(n))
        for (const n of nodes) toEl.appendChild(n)
      } catch (_) {}
    }

    if (isOutputMaximized) {
      // 进入全屏：把原容器里的内容搬到全屏容器
      moveAllChildren(gfxRootRef.current, fullscreenGfxRef.current)
      moveAllChildren(mplRootRef.current, fullscreenMplRef.current)
      // 将可见容器的 ID 映射为通用 ID，确保用户代码通过 getElementById('gfx-root'/'mpl-root') 能获取到当前可见容器
      try { if (gfxRootRef.current) gfxRootRef.current.id = 'gfx-root-hidden' } catch (_) {}
      try { if (fullscreenGfxRef.current) fullscreenGfxRef.current.id = 'gfx-root' } catch (_) {}
      try { if (mplRootRef.current) mplRootRef.current.id = 'mpl-root-hidden' } catch (_) {}
      try { if (fullscreenMplRef.current) fullscreenMplRef.current.id = 'mpl-root' } catch (_) {}
      // 重新绑定 Pixi 到全屏容器（确保输入与渲染在新容器中）
      rebindPixiRoot(fullscreenGfxRef.current)  
    } else {
      // 退出全屏：把内容搬回原容器
      moveAllChildren(fullscreenGfxRef.current, gfxRootRef.current)
      moveAllChildren(fullscreenMplRef.current, mplRootRef.current)
      // 还原通用 ID 到原容器
      try { if (fullscreenGfxRef.current) fullscreenGfxRef.current.id = 'gfx-root-fullscreen' } catch (_) {}
      try { if (gfxRootRef.current) gfxRootRef.current.id = 'gfx-root' } catch (_) {}
      try { if (fullscreenMplRef.current) fullscreenMplRef.current.id = 'mpl-root-fullscreen' } catch (_) {}
      try { if (mplRootRef.current) mplRootRef.current.id = 'mpl-root' } catch (_) {}
      // 重新绑定 Pixi 回原容器
      rebindPixiRoot(gfxRootRef.current)
      // 完成搬运后再卸载覆盖层
      setOverlayMounted(false)
    }
  }, [isOutputMaximized])
  
  // 面板大小和可见性控制
  const [editorWidth, setEditorWidth] = React.useState(60) // 百分比
  const [showEditor, setShowEditor] = React.useState(true)
  const [showOutput, setShowOutput] = React.useState(true)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // 有错误时自动切换到"错误"标签
  React.useEffect(() => {
    if (runError || (stderrText && stderrText.trim() !== '')) {
      setActiveConsoleTab('err')
    }
  }, [runError, stderrText])

  // 运行成功（无错误且有输出）时，如当前在“错误”标签则自动切回“输出”
  React.useEffect(() => {
    const noError = !runError && (!stderrText || stderrText.trim() === '')
    const hasVisibleOutput = (stdoutText && stdoutText.trim() !== '') || (outputImage && outputImage.trim() !== '')
    if (!running && activeConsoleTab === 'err' && noError && hasVisibleOutput) {
      setActiveConsoleTab('out')
    }
  }, [running, activeConsoleTab, runError, stderrText, stdoutText, outputImage])

  // 面板调整大小逻辑
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    
    const startX = e.clientX
    const startWidth = editorWidth
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const containerWidth = containerRef.current.offsetWidth
      const deltaX = e.clientX - startX
      const deltaPercent = (deltaX / containerWidth) * 100
      const newWidth = Math.max(20, Math.min(80, startWidth + deltaPercent))
      setEditorWidth(newWidth)
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [editorWidth])

  // 切换面板可见性
  const toggleEditor = () => {
    setShowEditor(!showEditor)
    if (!showEditor) {
      setShowOutput(true) // 确保至少有一个面板显示
    }
  }

  const toggleOutput = () => {
    setShowOutput(!showOutput)
    if (!showOutput) {
      setShowEditor(true) // 确保至少有一个面板显示
    }
  }

  // 导航函数
  const handleGoHome = () => {
    if (userInfo?.role === 'admin') {
      navigate('/www/admin/dashboard')
    } else {
      navigate('/www/user/dashboard')
    }
  }

  const handleGoToPrograms = () => {
    if (userInfo?.role === 'admin') {
      navigate('/www/admin/my_python')
    } else {
      navigate('/www/user/my_python')
    }
  }

  // 调试样式注入（断点小红点）
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const id = 'monaco-debugger-style'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.innerHTML = `
      .bp-glyph { width: 14px !important; height: 14px !important; border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 2px #fee2e2; }
      .bp-line { background: rgba(239, 68, 68, 0.08); }
      .current-line { background: rgba(59, 130, 246, 0.15) !important; }
      .current-glyph { position: relative; width: 0 !important; height: 0 !important; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 10px solid #3b82f6; margin-left: 2px; }
    `
    document.head.appendChild(style)
  }, [])

  // Monaco Editor 本地化配置（客户端）
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      async function configureMonacoLocal() {
        try {
          // 配置 MonacoEnvironment 以消除 Worker 警告
          (window as any).MonacoEnvironment = {
            getWorkerUrl: function (moduleId: string, label: string) {
              // 提供一个最小的内联 Worker，避免外部依赖
              if (label === 'json') {
                return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`
                  self.onmessage = function() {};
                `);
              }
              if (label === 'css' || label === 'scss' || label === 'less') {
                return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`
                  self.onmessage = function() {};
                `);
              }
              if (label === 'html' || label === 'handlebars' || label === 'razor') {
                return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`
                  self.onmessage = function() {};
                `);
              }
              if (label === 'typescript' || label === 'javascript') {
                return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`
                  self.onmessage = function() {};
                `);
              }
              // 默认 editor worker
              return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`
                self.onmessage = function() {};
              `);
            }
          };

          // 导入本机包 Monaco Editor
          const monaco = await import('monaco-editor')
          
          // 在导入后立即禁用 Worker 功能 (TypeScript 安全)
          ;(monaco.editor as any).setWorkerOptions = function() {
            // 空实现，禁用 Worker
          };
          
          loader.config({ monaco })
          console.log("✅ Monaco Editor 已配置为本机包加载（完全离线）")
          setMonacoConfig('bundle')
        } catch (bundleError: any) {
          console.warn("本机包配置失败:", bundleError.message)                      
          // 回退到 CDN 配置
          console.log("🔄 回退到默认 CDN 配置")
          setMonacoConfig('cdn')
        }
      }
      
      configureMonacoLocal()
    }
  }, [])

  // 动态加载本地 Pyodide（仅客户端）
  React.useEffect(() => {
    let mounted = true
    async function loadPyodideOnce() {
      if ((window as any).loadPyodide && mounted) {
        const py = await (window as any).loadPyodide({
          indexURL: `${HOST_URL}/pyodide/`,
        })
        // 预加载绘图与科学计算常用包
        try {
          await py.loadPackage(["matplotlib", "numpy"]) 
        } catch (_) {}
        if (mounted) setPyodide(py)
        return
      }
      const script = document.createElement("script")
      script.src = `${HOST_URL}/pyodide/pyodide.js`
      script.async = true
      script.onload = async () => {
        try {
          const py = await (window as any).loadPyodide({
            indexURL: `${HOST_URL}/pyodide/`,
          })
          try {
            await py.loadPackage(["matplotlib", "numpy"]) 
          } catch (_) {}
          if (mounted) setPyodide(py)
        } catch (e) {
          console.error("Failed to load pyodide:", e)
        }
      }
      document.body.appendChild(script)
    }
    if (typeof window !== "undefined") loadPyodideOnce()
    return () => {
      mounted = false
    }
  }, [])

  // 动态加载本地 PixiJS 并提供全局 GameAPI（仅客户端）
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    let disposed = false

    function ensureGameAPI() {
      if ((window as any).GameAPI) return
      (window as any).GameAPI = (function(){
        let app: any = null
        let stage: any = null
        let sprites: Record<string, any> = {}
        let input = { keys: new Set<string>(), mouse: { x: 0, y: 0, down: false } }
        let rootEl: HTMLElement | null = null
        let visible = false
        function notify(v: boolean) {
          try { window.dispatchEvent(new CustomEvent('fun-pixi-visible', { detail: v })) } catch {}
        }

        function bindInput(el: HTMLElement) {
          const onKeyDown = (e: KeyboardEvent) => input.keys.add(e.code)
          const onKeyUp = (e: KeyboardEvent) => input.keys.delete(e.code)
          const onMouseMove = (e: MouseEvent) => { input.mouse.x = e.offsetX; input.mouse.y = e.offsetY }
          const onMouseDown = () => { input.mouse.down = true }
          const onMouseUp = () => { input.mouse.down = false }
          window.addEventListener('keydown', onKeyDown)
          window.addEventListener('keyup', onKeyUp)
          el.addEventListener('mousemove', onMouseMove)
          el.addEventListener('mousedown', onMouseDown)
          el.addEventListener('mouseup', onMouseUp)
          ;(input as any)._unbind = () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            el.removeEventListener('mousemove', onMouseMove)
            el.removeEventListener('mousedown', onMouseDown)
            el.removeEventListener('mouseup', onMouseUp)
          }
        }

        return {
          init: (containerEl: HTMLElement, opts: { width: number; height: number }) => {
            if (!(window as any).PIXI) throw new Error('PIXI 未加载')
            if (app && rootEl === containerEl) {
              visible = true
              containerEl.style.display = ''
              notify(true)
              return
            }
            if (app) {
              try { (input as any)._unbind?.() } catch {}
              try { app.destroy(true, { children: true, texture: true, baseTexture: true }) } catch {}
              app = null; stage = null; sprites = {}
            }
            rootEl = containerEl
            const PIXI = (window as any).PIXI
            app = new PIXI.Application({ width: opts.width, height: opts.height, background: 0x222222, antialias: true })
            stage = app.stage
            containerEl.innerHTML = ''
            containerEl.appendChild(app.view as HTMLCanvasElement)
            bindInput(containerEl)
            visible = true
            containerEl.style.display = ''
            notify(true)
          },
          setVisible: (v: boolean) => {
            visible = v
            if (rootEl) rootEl.style.display = v ? '' : 'none'
            notify(!!v)
          },
          destroy: () => {
            try { (input as any)._unbind?.() } catch {}
            if (app) {
              try { app.destroy(true, { children: true, texture: true, baseTexture: true }) } catch {}
            }
            app = null; stage = null; sprites = {}; rootEl = null; visible = false
            notify(false)
          },
          loadAssets: async (assets: Record<string, string>) => {
            if (!(window as any).PIXI) throw new Error('PIXI 未加载')
            const PIXI = (window as any).PIXI
            const entries = Object.entries(assets)
            await Promise.all(entries.map(([alias, src]) => (PIXI.Assets as any).add({ alias, src })))
            await (PIXI.Assets as any).load(Object.keys(assets))
          },
          getInput: () => ({ keys: Array.from(input.keys), mouse: { ...input.mouse } }),
          setScene: (state: any) => {
            if (!app || !stage || !visible) return
            const PIXI = (window as any).PIXI
            if (typeof state?.background === 'number') {
              try { app.renderer.background.color = state.background } catch {}
            }
            const list: any[] = Array.isArray(state?.displayList) ? state.displayList : []
            const used: Record<string, boolean> = {}
            for (const item of list) {
              const id = String(item.id || item.key || Math.random())
              used[id] = true
              let node = sprites[id]
              if (!node) {
                if (item.type === 'sprite' && item.key) {
                  const tex = (PIXI.Assets as any).get(item.key)
                  if (!tex) continue
                  node = new PIXI.Sprite(tex)
                } else if (item.type === 'rect') {
                  node = new (PIXI as any).Graphics()
                } else if (item.type === 'text') {
                  node = new (PIXI as any).Text({ text: item.text || '', style: item.style || { fill: 0xffffff, fontSize: 14 } })
                }
                if (!node) continue
                sprites[id] = node
                stage.addChild(node)
              }
              if (item.type === 'sprite') {
                node.x = item.x || 0; node.y = item.y || 0
                if (item.anchor) node.anchor?.set(item.anchor.x ?? 0.5, item.anchor.y ?? 0.5)
                if (item.scale) node.scale?.set(item.scale.x ?? 1, item.scale.y ?? 1)
                if (item.rotation) node.rotation = item.rotation
                if (item.alpha != null) node.alpha = item.alpha
                if (item.visible != null) node.visible = !!item.visible
                if (item.w && item.h) { node.width = item.w; node.height = item.h }
                if (item.zIndex != null) node.zIndex = item.zIndex
              } else if (item.type === 'rect') {
                const g = node as any
                g.clear()
                g.beginFill(typeof item.fill === 'number' ? item.fill : 0x4ade80)
                g.drawRect(item.x || 0, item.y || 0, item.w || 10, item.h || 10)
                g.endFill()
                if (item.alpha != null) g.alpha = item.alpha
                if (item.visible != null) g.visible = !!item.visible
              } else if (item.type === 'text') {
                node.text = item.text || ''
                node.x = item.x || 0; node.y = item.y || 0
                if (item.style) node.style = item.style
                if (item.alpha != null) node.alpha = item.alpha
                if (item.visible != null) node.visible = !!item.visible
              }
            }
            Object.keys(sprites).forEach((id) => {
              if (!used[id]) {
                const n = sprites[id]
                try { stage.removeChild(n); n.destroy?.() } catch {}
                delete sprites[id]
              }
            })
          },
        }
      })()
    }

    function loadPixi() {
      if ((window as any).PIXI) { ensureGameAPI(); return }
      const s = document.createElement('script')
      s.src = `${HOST_URL}/pyodide/pixi/pixi.min.js`
      s.async = true
      s.onload = () => { if (!disposed) ensureGameAPI() }
      document.head.appendChild(s)
    }
    loadPixi()
    const onVisible = (e: any) => {
      try { setPixiVisible(Boolean(e?.detail)) } catch {}
    }
    try { window.addEventListener('fun-pixi-visible', onVisible as any) } catch {}
    return () => {
      disposed = true
      try { window.removeEventListener('fun-pixi-visible', onVisible as any) } catch {}
    }
  }, [])

  const handleRun = React.useCallback(async () => {
    if (!pyodide) {
      setOutputText("Pyodide 加载中，请稍候...")
      return
    }
    // 每次运行前，确保销毁旧的 Pixi 实例以保证游戏可重启
    try { (window as any).GameAPI?.destroy?.() } catch (_) {}
    setRunning(true)
    setSyntaxError(null)
    setRunError(null)
    setOutputText("")
    setOutputImage("")
    setStdoutText("")
    setStderrText("")
    // 清空 matplotlib 容器（普通/全屏都清空，稍后使用活跃容器渲染）
    try { if (mplRootRef.current) mplRootRef.current.innerHTML = '' } catch (_) {}
    try { if (fullscreenMplRef.current) fullscreenMplRef.current.innerHTML = '' } catch (_) {}
    // 默认隐藏 Pixi 画布，直到用户代码中显式启用
    try { (window as any).GameAPI?.setVisible(false) } catch (_) {}
    try {
      const wrapped = `\nimport sys, io, traceback, base64\nout_buffer = io.StringIO()\nerr_buffer = io.StringIO()\n_sys_stdout = sys.stdout\n_sys_stderr = sys.stderr\nsys.stdout = out_buffer\nsys.stderr = err_buffer\n\n# 实现 input() 支持（基于参考代码）\nfrom js import prompt\ndef input_wrapper(p=""):\n    return prompt(p)\n__builtins__.input = input_wrapper\n\n# 运行前尝试清理旧的图形与游戏状态\ntry:\n    import matplotlib.pyplot as _plt\n    _plt.close('all')\nexcept Exception:\n    pass\nns = {}\nimg_b64 = ""\ntry:\n    exec(${JSON.stringify(code)}, ns)\n    try:\n        import matplotlib.pyplot as plt\n        if plt.get_fignums():\n            bio = io.BytesIO()\n            plt.savefig(bio, format='png', dpi=150, bbox_inches='tight')\n            bio.seek(0)\n            img_b64 = 'data:image/png;base64,' + base64.b64encode(bio.read()).decode('ascii')\n            plt.close('all')\n    except Exception:\n        pass\nexcept Exception as e:\n    traceback.print_exc()\nfinally:\n    sys.stdout = _sys_stdout\n    sys.stderr = _sys_stderr\nres = {'stdout': out_buffer.getvalue(), 'stderr': err_buffer.getvalue(), 'image': img_b64}\nimport json\njson.dumps(res)\n`
      const json = await pyodide.runPythonAsync(wrapped)
      try {
        const parsed = JSON.parse(String(json))
        const s = String(parsed.stdout || "")
        const e = String(parsed.stderr || "")
        const outCombined = e ? (s ? (s + "\n" + e) : e) : s
        setOutputText(outCombined)
        setStdoutText(s)
        setStderrText(e)
        const img = String(parsed.image || "")
        setOutputImage(img)
        try {
          const activeRoot = isOutputMaximized ? fullscreenMplRef.current : mplRootRef.current
          if (img && activeRoot) {
            const imgEl = document.createElement('img')
            imgEl.src = img
            imgEl.className = 'max-w-full h-auto rounded-lg border border-gray-200'
            activeRoot.innerHTML = ''
            activeRoot.appendChild(imgEl)
          }
        } catch (_) {}
        // 尝试从标准输出/标准错误中解析语法或运行错误
        const out = outCombined
        if (out.includes("SyntaxError")) {
          const se = parseSyntaxError(out, code.split('\n').length)
          setSyntaxError(se)
          setRunError(se)
          // 确保错误可见
          requestAnimationFrame(() => {
            outputRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          })
        } else if (out.includes("Traceback")) {
          const se = parseSyntaxError(out, code.split('\n').length)
          setRunError(se)
          requestAnimationFrame(() => {
            outputRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          })
        }
      } catch (e) {
        setOutputText(String(json || ""))
        const out = String(json || "")
        if (out.includes("SyntaxError")) {
          const se = parseSyntaxError(out, code.split('\n').length)
          setSyntaxError(se)
          setRunError(se)
          requestAnimationFrame(() => {
            outputRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          })
        } else if (out.includes("Traceback")) {
          const se = parseSyntaxError(out, code.split('\n').length)
          setRunError(se)
          requestAnimationFrame(() => {
            outputRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          })
        }
      }
    } catch (e: any) {
      setOutputText(String(e?.message || e || "运行出错"))
      const msg = String(e?.message || e || "")
      if (msg.includes("SyntaxError")) {
        const se = parseSyntaxError(msg)
        setSyntaxError(se)
        setRunError(se)
      } else if (msg) {
        const generic = parseSyntaxError(msg)
        setRunError({ message: generic.message, line: generic.line })
      }
      requestAnimationFrame(() => {
        outputRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      })
    } finally {
      setRunning(false)
    }
  }, [pyodide, code, isOutputMaximized])

  const handleClear = () => {
    setOutputText("")
    setOutputImage("")
    setStdoutText("")
    setStderrText("")
    setLogsText("")
    setSyntaxError(null)
    setRunError(null)
  }

  const handleNew = () => {
    // 重置所有状态
    const newCode = [
      "# 新建 Python 程序",
      "# 在这里编写你的代码",
      "print('Hello, World!')",
    ].join("\n")
    setCode(newCode)
    lastCodeRef.current = newCode
    setProgramName("未命名程序")
    try {
      const u = userInfo as any
      const owner = (u?.nickname || u?.username || "") as string
      setOwnerName(owner)
      if (typeof document !== 'undefined') document.title = owner ? `${owner}-未命名程序` : `未命名程序`
    } catch (_) {}
    setProgramId(null)
    setOutputText("")
    setOutputImage("")
    setSyntaxError(null)
    setRunError(null)
    setMenuOpen(false)
    setHasUnsavedChanges(false)
    setLastSaveTime(null)
    
    // 更新浏览器 URL 到新建页面
    navigate("/www/user/programs/new", { replace: true })
  }

  // 解析 Python 语法错误的辅助函数
  function parseSyntaxError(text: string, totalLines?: number): { message: string; line?: number } {
    // Python traceback 通常包含: File "<string>", line N, ... SyntaxError: message
    let line: number | undefined = undefined
    // 优先匹配 <string> 的行号（即用户代码行号）
    let lineMatch = text.match(/File\s+"<string>",\s+line\s+(\d+)/i)
    if (!lineMatch) {
      // 退化到任意 line N
      lineMatch = text.match(/line\s+(\d+)/i)
    }
    if (lineMatch) {
      const n = parseInt(lineMatch[1], 10)
      if (!isNaN(n)) line = n
    }
    const lines = text.split('\n')
    // 优先 SyntaxError 行
    let msgLine = (lines.find(l => l.toLowerCase().includes('syntaxerror')) || '').trim()
    // 其次取 Traceback 的最后一行（一般是 Exception: msg）
    if (!msgLine) {
      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i].trim()
        if (!l) continue
        if (/\w+Error:/.test(l) || /\w+Exception:/.test(l)) { msgLine = l; break }
      }
    }
    const message = msgLine || '运行错误'
    // 将行号约束在有效范围内
    if (typeof line === 'number' && typeof totalLines === 'number' && totalLines > 0) {
      if (line < 1) line = 1
      if (line > totalLines) line = totalLines
    }
    return { message, line }
  }

  // 跳转到指定行
  const focusLine = React.useCallback((line?: number) => {
    if (!line || !editorRef.current) return
    try {
      editorRef.current.setPosition({ lineNumber: line, column: 1 })
      editorRef.current.revealLineInCenter(line)
      editorRef.current.focus()
    } catch (_) {}
  }, [])

  const handleRename = async () => {
    const input = window.prompt("请输入新的程序名称", programName)
    if (input != null && input.trim() !== "") {
      const newName = input.trim()
      setProgramName(newName)
      try { if (typeof document !== 'undefined') document.title = ownerName ? `${ownerName}-${newName}` : newName } catch (_) {}
      
      // 重命名后自动保存文件
      try {
        const idFromRoute = routeProgramId ? Number(routeProgramId) : 0
        const idToSave = typeof programId === "number" && !isNaN(programId) ? programId : (isNaN(idFromRoute) ? 0 : idFromRoute)

        const resp = await fetchWithAuth(`${HOST_URL}/api/programs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: idToSave,
            name: newName,
            type: programType,
            program: code,
          }),
        })

        if (resp.ok) {
          try {
            const data = await resp.json()
            if (data && (data.id != null || (data.data && data.data.id != null))) {
              const returnedId = data.id ?? data.data.id
              if (typeof returnedId === "number") setProgramId(returnedId)
            }
          } catch (_) {}
          setLastSaveTime(new Date())
          setHasUnsavedChanges(false)
          lastCodeRef.current = code
          console.log("重命名并保存成功")
          ;(window as any).toast?.success?.("重命名并保存成功")
        } else {
          const txt = await resp.text()
          console.error("重命名保存失败", txt)
          ;(window as any).toast?.error?.("重命名保存失败")
        }
      } catch (e) {
        console.error("重命名保存失败", e)
        ;(window as any).toast?.error?.("重命名保存失败")
      }
    }
  }

  // 自动保存函数（静默保存，不弹出命名对话框）
  const handleAutoSave = React.useCallback(async () => {
    // 如果程序未命名或者是默认名称且没有 programId，则不自动保存
    const nameToUse = programName
    if (!nameToUse || nameToUse.trim() === "" || (nameToUse === "未命名程序" && !programId && !routeProgramId)) {
      return
    }

    // 如果没有未保存的更改，则不保存
    if (!hasUnsavedChanges) {
      return
    }

    setIsAutoSaving(true)
    try {
      const idFromRoute = routeProgramId ? Number(routeProgramId) : 0
      const idToSave = typeof programId === "number" && !isNaN(programId) ? programId : (isNaN(idFromRoute) ? 0 : idFromRoute)

      const resp = await fetchWithAuth(`${HOST_URL}/api/programs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: idToSave,
          name: nameToUse,
          type: programType,
          program: code,
        }),
      })

      if (resp.ok) {
        try {
          const data = await resp.json()
          if (data && (data.id != null || (data.data && data.data.id != null))) {
            const returnedId = data.id ?? data.data.id
            if (typeof returnedId === "number") setProgramId(returnedId)
          }
        } catch (_) {}
        setLastSaveTime(new Date())
        setHasUnsavedChanges(false)
        lastCodeRef.current = code
        console.log("自动保存成功")
      } else {
        console.error("自动保存失败")
      }
    } catch (e) {
      console.error("自动保存失败", e)
    } finally {
      setIsAutoSaving(false)
    }
  }, [code, programName, programId, routeProgramId, programType, hasUnsavedChanges])

  const handleSave = React.useCallback(async () => {
    try {
      // 若用户未命名，弹出一次命名对话框
      let nameToUse = programName
      // 只有在程序名称为空、空白字符串或者是默认的"未命名程序"时才弹出命名对话框
      if (!nameToUse || nameToUse.trim() === "" || (nameToUse === "未命名程序" && !routeProgramId)) {
        const input = window.prompt("请输入程序名称", programName || "未命名程序")
        if (input == null) {
          return
        }
        nameToUse = input.trim() || "未命名程序"
        setProgramName(nameToUse)
        try { if (typeof document !== 'undefined') document.title = ownerName ? `${ownerName}-${nameToUse}` : nameToUse } catch (_) {}
      }

      const idFromRoute = routeProgramId ? Number(routeProgramId) : 0
      const idToSave = typeof programId === "number" && !isNaN(programId) ? programId : (isNaN(idFromRoute) ? 0 : idFromRoute)

      const resp = await fetchWithAuth(`${HOST_URL}/api/programs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: idToSave,
          name: nameToUse,
          type: programType,
          program: code,
        }),
      })

      if (resp.ok) {
        try {
          const data = await resp.json()
          if (data && (data.id != null || (data.data && data.data.id != null))) {
            const returnedId = data.id ?? data.data.id
            if (typeof returnedId === "number") setProgramId(returnedId)
            // 只有在新建程序时才更新程序名称，避免覆盖已加载的程序名称
            if (!routeProgramId) {
              setProgramName(nameToUse)
              try { if (typeof document !== 'undefined') document.title = ownerName ? `${ownerName}-${nameToUse}` : nameToUse } catch (_) {}
            }
            // 保存成功后跳转到打开页面
            if (typeof returnedId === "number") {
              navigate(`/www/user/programs/open/${returnedId}`, { replace: true })
            }
          }
        } catch (_) {}
        setMenuOpen(false)
        setLastSaveTime(new Date())
        setHasUnsavedChanges(false)
        lastCodeRef.current = code
        // 简单提示
        console.log("保存成功")
        ;(window as any).toast?.success?.("保存成功")
      } else {
        const txt = await resp.text()
        console.error("保存失败", txt)
        ;(window as any).toast?.error?.("保存失败")
        alert("保存失败")
      }
    } catch (e) {
      console.error(e)
      ;(window as any).toast?.error?.("保存失败")
      alert("保存失败")
    }
  }, [code, programName, programId, routeProgramId, programType, ownerName, navigate])

  const handleSaveToComputer = React.useCallback(async () => {
    try {
      const defaultName = (programName && programName.trim()) ? programName.trim() : "未命名程序"
      const filename = defaultName.endsWith('.py') ? defaultName : `${defaultName}.py`
      const content = code ?? ''

      // 优先使用 File System Access API
      if (typeof (window as any).showSaveFilePicker === 'function') {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Python 文件',
              accept: {
                'text/x-python': ['.py'],
                'text/plain': ['.py']
              }
            }
          ]
        })
        const writable = await handle.createWritable()
        await writable.write(new Blob([content], { type: 'text/x-python' }))
        await writable.close()
      } else {
        // 回退为浏览器下载
        const blob = new Blob([content], { type: 'text/x-python' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }

      setMenuOpen(false)
      ;(window as any).toast?.success?.("已保存到电脑")
    } catch (e) {
      console.error("保存到电脑失败", e)
      ;(window as any).toast?.error?.("保存到电脑失败")
    }
  }, [code, programName])

  const handleViewHistory = React.useCallback(async () => {
    setMenuOpen(false)
    
    // 先保存当前内容
    try {
      // 若用户未命名且没有 programId，弹出一次命名对话框
      let nameToUse = programName
      const idFromRoute = routeProgramId ? Number(routeProgramId) : 0
      const hasExistingId = (typeof programId === "number" && !isNaN(programId)) || (idFromRoute > 0)
      
      if (!hasExistingId && (!nameToUse || nameToUse.trim() === "" || nameToUse === "未命名程序")) {
        const input = window.prompt("请输入程序名称", programName || "未命名程序")
        if (input == null) {
          return // 用户取消命名，不跳转
        }
        nameToUse = input.trim() || "未命名程序"
        setProgramName(nameToUse)
        try { if (typeof document !== 'undefined') document.title = ownerName ? `${ownerName}-${nameToUse}` : nameToUse } catch (_) {}
      }

      const idToSave = typeof programId === "number" && !isNaN(programId) ? programId : (isNaN(idFromRoute) ? 0 : idFromRoute)

      const resp = await fetchWithAuth(`${HOST_URL}/api/programs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: idToSave,
          name: nameToUse,
          type: programType,
          program: code,
        }),
      })

      if (resp.ok) {
        try {
          const data = await resp.json()
          if (data && (data.id != null || (data.data && data.data.id != null))) {
            const returnedId = data.id ?? data.data.id
            if (typeof returnedId === "number") {
              setProgramId(returnedId)
              setLastSaveTime(new Date())
              setHasUnsavedChanges(false)
              lastCodeRef.current = code
              // 保存成功后跳转到历史记录页面
              navigate(`/www/user/programs/${returnedId}/histories`)
              return
            }
          }
        } catch (_) {}
        // 如果返回了 ID 但解析失败，使用保存时的 ID
        const finalId = typeof programId === "number" && !isNaN(programId) ? programId : (isNaN(idFromRoute) ? null : idFromRoute)
        if (finalId) {
          setLastSaveTime(new Date())
          setHasUnsavedChanges(false)
          lastCodeRef.current = code
          navigate(`/www/user/programs/${finalId}/histories`)
        } else {
          ;(window as any).toast?.error?.("保存成功，但无法获取程序ID")
        }
      } else {
        const txt = await resp.text()
        console.error("保存失败", txt)
        ;(window as any).toast?.error?.("保存失败，无法查看历史记录")
      }
    } catch (e) {
      console.error("保存失败", e)
      ;(window as any).toast?.error?.("保存失败，无法查看历史记录")
    }
  }, [code, programName, programId, routeProgramId, programType, ownerName, navigate])

  // 检测代码变化
  React.useEffect(() => {
    // 如果代码与上次保存的代码不同，则标记为未保存
    if (code !== lastCodeRef.current) {
      setHasUnsavedChanges(true)
    }
  }, [code])

  // 定时保存：每30秒自动保存一次
  React.useEffect(() => {
    const interval = setInterval(() => {
      handleAutoSave()
    }, 30000) // 30秒

    return () => {
      clearInterval(interval)
    }
  }, [handleAutoSave])

  // 若带有 programId，加载程序内容并填充
  React.useEffect(() => {
    let mounted = true
    // 优先用路由参数初始化 programId，避免保存时为 0
    if (routeProgramId) {
      const n = Number(routeProgramId)
      if (!isNaN(n)) setProgramId(n)
    }
    async function loadIfNeeded() {
      if (!routeProgramId) return
      try {
        const resp = await fetchWithAuth(`${HOST_URL}/api/programs/${routeProgramId}`)
        if (!resp.ok) return
        const data = await resp.json()
        if (!mounted || !data) return
        
        console.log("加载程序数据:", data) // 调试信息
        console.log("数据类型:", typeof data)
        console.log("data.name:", data.name)
        console.log("data.data:", data.data)
        
        // gorails框架将响应包装在data字段中
        const programData = data.data || data
        
        console.log("程序数据:", programData)
        
        // 加载程序名称
        if (programData && typeof programData.name === "string" && programData.name.trim() !== "") {
          console.log("设置程序名称:", programData.name)
          setProgramName(programData.name)
          try {
            const owner = (programData.owner_nickname || programData.owner_username || programData.user?.nickname || programData.user?.username || "") as string
            setOwnerName(owner)
            if (typeof document !== 'undefined') document.title = owner ? `${owner}-${programData.name}` : programData.name
          } catch (_) {}
        } else {
          console.log("程序名称为空或无效:", programData?.name)
          try {
            const owner = (programData.owner_nickname || programData.owner_username || programData?.user?.nickname || programData?.user?.username || "") as string
            setOwnerName(owner)
            if (typeof document !== 'undefined') document.title = owner ? `${owner}-未命名程序` : '未命名程序'
          } catch (_) {}
        }
        
        // 加载程序代码
        if (programData && typeof programData.program === "string") {
          console.log("设置程序代码，长度:", programData.program.length)
          setCode(programData.program)
          lastCodeRef.current = programData.program
          setHasUnsavedChanges(false)
          setLastSaveTime(new Date())
        }
        
        // 加载程序ID
        if (programData && typeof programData.id === "number") {
          console.log("设置程序ID:", programData.id)
          setProgramId(programData.id)
        }
      } catch (e) {
        console.error("加载程序失败:", e)
      }
    }
    loadIfNeeded()
    return () => {
      mounted = false
    }
  }, [routeProgramId])

  // 调试：监听 programName 变化
  React.useEffect(() => {
    console.log("programName 状态变化:", programName)
  }, [programName])

  // 点击外部区域关闭菜单
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpen) {
        const target = event.target as Element
        // 检查点击的元素是否在菜单内部
        const menuElement = document.querySelector('[data-menu="file-menu"]')
        if (menuElement && !menuElement.contains(target)) {
          setMenuOpen(false)
        }
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  // 在编辑器挂载时注册 Shift+Enter 运行快捷键
  const handleEditorMount = React.useCallback(
    (editor: any, monaco: any) => {
      editorRef.current = editor
      monacoRef.current = monaco
      try {
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
          handleRun()
        })
      } catch (_) {}

      // 配置Python语言支持
      configurePythonLanguage(monaco)

      // 初始化断点装饰
      refreshBreakpointDecorations(editor, monaco, breakpoints)

      // 点击行号/边距切换断点
      try {
        // 若之前已绑定，先移除，避免重复绑定导致的多次触发
        try { mouseDownDisposeRef.current?.dispose?.() } catch (_) {}
        mouseDownDisposeRef.current = editor.onMouseDown((e: any) => {
          // 仅在点击断点图标所在的 glyph margin 且为左键时切换断点
          if (e.event?.browserEvent?.button !== 0) return
          if (e.target?.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
            const line = e.target.position?.lineNumber
            if (!line) return
            // 使用函数式更新，避免闭包拿到过期的 breakpoints 状态
            setBreakpoints((prev) => {
              const next = new Set(prev)
              if (next.has(line)) next.delete(line); else next.add(line)
              refreshBreakpointDecorations(editor, monaco, next)
              return next
            })
          }
        })
      } catch (_) {}
    },
    [handleRun]
  )

  // 重新绑定快捷键，确保闭包中拿到最新的 pyodide 与代码
  React.useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    try {
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        handleRun()
      })
    } catch (_) {}
  }, [pyodide, handleRun])

  // 当断点状态变化时，更新断点装饰
  React.useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    refreshBreakpointDecorations(editor, monaco, breakpoints)
  }, [breakpoints])

  // 断点装饰刷新
  function refreshBreakpointDecorations(editor: any, monaco: any, bps: Set<number>) {
    try {
      const decos = Array.from(bps).map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'bp-line',
          glyphMarginClassName: 'bp-glyph',
          glyphMarginHoverMessage: { value: `断点: 行 ${line}` },
        },
      }))
      const applied = editor.deltaDecorations(bpDecorationsRef.current, decos)
      bpDecorationsRef.current = applied
    } catch (_) {}
  }

  // 当前行装饰（调试暂停时）
  function markCurrentLine(editor: any, monaco: any, line?: number | null) {
    try {
      const ranges = [] as any[]
      if (line) {
        ranges.push({
          range: new monaco.Range(line, 1, line, 1),
          options: { 
            isWholeLine: true, 
            className: 'current-line', 
            glyphMarginClassName: 'current-glyph' 
          },
        })
      }
      const applied = editor.deltaDecorations(currentLineDecorationsRef.current, ranges)
      currentLineDecorationsRef.current = applied
    } catch (_) {}
  }

  async function debugStart() {
    setDebugging(true)
    setPausedLine(null)
    setLocalsView("")
    // 若存在断点，则运行到第一个断点；否则直接结束（不自动在行1暂停）
    const hasBp = breakpoints.size > 0
    if (hasBp) {
      await debugContinue()
    } else {
      const editor = editorRef.current, monaco = monacoRef.current
      if (editor && monaco) markCurrentLine(editor, monaco, null)
      setDebugging(true)
      setPausedLine(null)
      setLocalsView('未设置断点。点击左侧添加断点，然后使用"继续/单步"。')
    }
  }

  function debugStop() {
    setDebugging(false)
    setPausedLine(null)
    setLocalsView("")
    const editor = editorRef.current, monaco = monacoRef.current
    if (editor && monaco) markCurrentLine(editor, monaco, null)
  }

  async function debugContinue(stepOnce = false) {
    if (!pyodide) return
    const editor = editorRef.current, monaco = monacoRef.current
    if (!editor || !monaco) return

    const bpList = JSON.stringify(Array.from(breakpoints))
    const src = code
    const py = `\nimport sys, io, json, linecache, base64\n_breakpoints = set(json.loads(${JSON.stringify(bpList)}))\n_src = ${JSON.stringify(src)}\n_prev_line = ${pausedLine ?? 0}\n_step_once = ${stepOnce ? 'True' : 'False'}\nlinecache.cache['<string>'] = (len(_src), None, [l+'\\n' for l in _src.split('\\n')], '<string>')\n\nclass _DbgPause(Exception):\n    pass\n\n_buffer = io.StringIO()\n_sys_stdout = sys.stdout\nsys.stdout = _buffer\n_state = {'paused': False, 'line': None, 'locals': {}}\n_img_b64 = ''\n_DEF_REPR_MAX = 200\n\ndef _safe_repr(v):\n    try:\n        s = repr(v)\n        if len(s) > _DEF_REPR_MAX:\n            s = s[:_DEF_REPR_MAX] + '…'\n        return s\n    except Exception:\n        return '<unrepr>'\n\ndef _snapshot_plot():\n    global _img_b64\n    try:\n        import matplotlib.pyplot as _plt\n        if _plt.get_fignums():\n            bio = io.BytesIO()\n            _plt.savefig(bio, format='png', dpi=150, bbox_inches='tight')\n            bio.seek(0)\n            _img_b64 = 'data:image/png;base64,' + base64.b64encode(bio.read()).decode('ascii')\n            _plt.close('all')\n    except Exception:\n        pass\n\ndef _trace(frame, event, arg):\n    if frame.f_code.co_filename != '<string>':\n        return _trace\n    if event == 'line':\n        ln = frame.f_lineno\n        should_pause = False\n        if _step_once and ln > _prev_line:\n            should_pause = True\n        if ln in _breakpoints and ln > _prev_line:\n            should_pause = True\n        if should_pause:\n            _state['paused'] = True\n            _state['line'] = ln\n            try:\n                _state['locals'] = {k: _safe_repr(v) for k, v in frame.f_locals.items() if k != '__builtins__' and not k.startswith('__')}\n            except Exception:\n                _state['locals'] = {}\n            _snapshot_plot()\n            raise _DbgPause()\n    return _trace\n\nsys.settrace(_trace)\ntry:\n    g = {'__name__': '__main__'}\n    exec(compile(_src, '<string>', 'exec'), g, g)\nexcept _DbgPause:\n    pass\nfinally:\n    sys.settrace(None)\n    if not _state['paused']:\n        _snapshot_plot()\n\nres = {'stdout': _buffer.getvalue(), 'state': _state, 'image': _img_b64}\nimport json\njson.dumps(res)\n`

    const raw = await pyodide.runPythonAsync(py)
    const resp = JSON.parse(String(raw || '{}'))
    const st = resp.state || {}
    setOutputText(String(resp.stdout || ""))
    setOutputImage(String(resp.image || ""))
    // 在调试暂停或结束后，若有图像，也渲染到活跃容器
    try {
      const img = String(resp.image || "")
      const activeRoot = isOutputMaximized ? fullscreenMplRef.current : mplRootRef.current
      if (img && activeRoot) {
        const imgEl = document.createElement('img')
        imgEl.src = img
        imgEl.className = 'max-w-full h-auto rounded-lg border border-gray-200'
        activeRoot.innerHTML = ''
        activeRoot.appendChild(imgEl)
      }
    } catch (_) {}
    if (st.paused) {
      setPausedLine(st.line || null)
      // 过滤 __builtins__ 和双下划线变量，并限制每个值长度
      const rawLocals = (st.locals || {}) as Record<string, unknown>
      const filteredEntries = Object.entries(rawLocals)
        .filter(([k]) => k !== '__builtins__' && !k.startsWith('__'))
        .map(([k, v]) => {
          const s = String(v ?? '')
          return [k, s.length > 200 ? s.slice(0, 200) + '…' : s]
        })
      const filtered = Object.fromEntries(filteredEntries)
      setLocalsView(JSON.stringify(filtered, null, 2))
      markCurrentLine(editor, monaco, st.line || null)
    } else {
      setPausedLine(null)
      setLocalsView("")
      markCurrentLine(editor, monaco, null)
    }
  }

  async function debugStep() {
    if (!debugging) return
    await debugContinue(true)
  }

  // 组件卸载或编辑器被替换时，清理监听与装饰，避免重复与残留
  React.useEffect(() => {
    return () => {
      try { mouseDownDisposeRef.current?.dispose?.() } catch {}
      try {
        const editor = editorRef.current
        if (editor) {
          editor.deltaDecorations(bpDecorationsRef.current, [])
          editor.deltaDecorations(currentLineDecorationsRef.current, [])
        }
      } catch {}
    }
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="h-16 px-6 flex items-center justify-between border-b-2 border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-4">
          {/* 首页和程序列表按钮 - 最左侧 */}
          <button
            onClick={handleGoHome}
            className="px-4 py-3 rounded-xl bg-blue-50 border-2 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 font-medium text-sm flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            首页
          </button>
          <button
            onClick={handleGoToPrograms}
            className="px-4 py-3 rounded-xl bg-purple-50 border-2 border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 font-medium text-sm flex items-center gap-2"
          >
            <Code2 className="h-4 w-4" />
            程序列表
          </button>
          <div className="w-px h-8 bg-gray-300"></div>
          
          {/* 文件菜单 */}
          <div className="relative" data-menu="file-menu">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="px-4 py-2 rounded-xl bg-purple-50 border-2 border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 font-medium text-sm"
            >
              📁 文件 ▾
            </button>
            {menuOpen ? (
              <div className="absolute mt-2 min-w-[180px] rounded-xl border-2 border-purple-200 bg-white shadow-xl z-10">
                <button
                  className="w-full text-left px-4 py-3 hover:bg-purple-50 rounded-t-xl transition-colors duration-200"
                  onClick={handleNew}
                >
                  📄 新建
                </button>
                <div className="border-t border-gray-200"></div>
                <button
                  className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors duration-200"
                  onClick={handleRename}
                >
                  ✏️ 重命名
                </button>
                <button
                  className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors duration-200"
                  onClick={handleSave}
                >
                  💾 保存
                </button>
                <div className="border-t border-gray-200"></div>
                <button
                  className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors duration-200"
                  onClick={handleViewHistory}
                >
                  📜 历史记录
                </button>
                <div className="border-t border-gray-200"></div>
                <button
                  className="w-full text-left px-4 py-3 hover:bg-purple-50 rounded-b-xl transition-colors duration-200"
                  onClick={handleSaveToComputer}
                >
                  🖥️ 保存到电脑
                </button>
              </div>
            ) : null}
          </div>
          
          {/* 程序名称和状态 */}
          <div className="flex items-center gap-3">
            <div className="font-bold text-xl text-gray-900">
              {programName || "未命名程序"}
            </div>
            <span className="text-sm text-gray-500">
              {monacoConfig === 'local' && "🌐 本地服务器"}
              {monacoConfig === 'bundle' && "📦 离线模式"}
              {monacoConfig === 'cdn' && "☁️ CDN 模式"}
              {monacoConfig === 'loading' && "⏳ 加载中"}
            </span>
            {/* 保存状态显示 */}
            <div className="flex items-center gap-2 text-xs">
              {isAutoSaving ? (
                <span className="text-blue-600 flex items-center gap-1">
                  <div className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  保存中...
                </span>
              ) : hasUnsavedChanges ? (
                <span className="text-orange-600">● 未保存</span>
              ) : lastSaveTime ? (
                <span className="text-green-600">
                  ✓ 已保存 {lastSaveTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={toggleEditor}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-all duration-200 ${
                showEditor 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
              title={showEditor ? '隐藏编辑器' : '显示编辑器'}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={toggleOutput}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-all duration-200 ${
                showOutput 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
              title={showOutput ? '隐藏输出面板' : '显示输出面板'}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm8 0a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1V8z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="w-px h-8 bg-gray-300"></div>
          <button
            onClick={handleRun}
            disabled={running}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-60 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            {running ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                运行中...
              </>
            ) : (
              <>
                ▶️ 运行代码
                <span className="text-xs opacity-80">(Shift+Enter)</span>
              </>
            )}
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-3 rounded-xl bg-gray-100 border-2 border-gray-200 text-gray-700 hover:bg-gray-200 hover:border-gray-300 transition-all duration-200 font-medium text-sm"
          >
            🗑️ 清空输出
          </button>
        </div>
      </div>

      {/* 主体两栏布局 */}
      <div ref={containerRef} className="flex h-[calc(100vh-4rem)]">
        {showEditor && (
          <div 
            className="h-full bg-white relative"
            style={{ width: showOutput ? `${editorWidth}%` : '100%' }}
          >
            {typeof window !== "undefined" && monacoConfig !== 'loading' ? (
              <Editor
                height="100%"
                defaultLanguage="python"
                value={code}
                onChange={(v: any) => setCode(v ?? "")}
                theme="vs-light"
                onMount={handleEditorMount}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  wordWrap: "on",
                  tabSize: 4,
                  insertSpaces: true,
                  padding: { top: 16, bottom: 16 },
                  lineNumbers: "on",
                  renderLineHighlight: "line",
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  glyphMargin: true,
                  // 启用自动补全
                  suggest: {
                    showKeywords: true,
                    showSnippets: true,
                    showFunctions: true,
                    showConstructors: true,
                    showFields: true,
                    showVariables: true,
                    showClasses: true,
                    showStructs: true,
                    showInterfaces: true,
                    showModules: true,
                    showProperties: true,
                    showEvents: true,
                    showOperators: true,
                    showUnits: true,
                    showValues: true,
                    showConstants: true,
                    showEnums: true,
                    showEnumMembers: true,
                    showColors: true,
                    showFiles: true,
                    showReferences: true,
                    showFolders: true,
                    showTypeParameters: true,
                    showIssues: true,
                    showUsers: true,
                    showWords: true
                  },
                  // 自动补全触发字符
                  quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: true
                  },
                  // 接受建议的快捷键
                  acceptSuggestionOnEnter: "on",
                  // 建议选择器
                  suggestOnTriggerCharacters: true,
                  // 自动显示建议
                  suggestSelection: "first",
                  // 代码片段建议
                  snippetSuggestions: "top",
                  // 参数提示
                  parameterHints: {
                    enabled: true
                  },
                  // 悬停提示
                  hover: {
                    enabled: true
                  }
                }}
                loading={
                  <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                      <div className="text-lg font-semibold text-gray-700 mb-2">Monaco Editor 加载中...</div>
                      <div className="text-sm text-gray-500 capitalize">
                        {monacoConfig === 'local' && "🌐 本地服务器版本"}
                        {monacoConfig === 'bundle' && "📦 本机包版本（离线）"}
                        {monacoConfig === 'cdn' && "☁️ CDN 版本"}
                      </div>
                    </div>
                  </div>
                }
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center">
                    <span className="text-2xl">⌨️</span>
                  </div>
                  <div className="text-lg font-semibold text-gray-700 mb-2">
                    {monacoConfig === 'loading' 
                      ? "⏳ 初始化 Monaco Editor..." 
                      : "⌨️ 编辑器需要客户端环境"}
                  </div>
                  <div className="text-sm text-gray-500">请稍候，编辑器正在加载...</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 拖拽手柄 */}
        {showEditor && showOutput && (
          <div
            className={`w-1 bg-gray-200 hover:bg-blue-300 cursor-col-resize transition-colors duration-200 flex items-center justify-center group ${
              isResizing ? 'bg-blue-400' : ''
            }`}
            onMouseDown={handleMouseDown}
            title="拖拽调整面板大小"
          >
            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="w-0.5 h-0.5 bg-gray-500 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-gray-500 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-gray-500 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-gray-500 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-gray-500 rounded-full"></div>
            </div>
          </div>
        )}

        {showOutput && (
          <div 
            className="h-full flex flex-col bg-white"
            style={{ width: showEditor ? `${100 - editorWidth}%` : '100%' }}
          >
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b-2 border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <span className="font-bold text-gray-900">运行结果</span>
              <span className="text-sm text-gray-500">/ Result</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => (debugging ? debugStop() : debugStart())}
                  className={`px-3 py-1.5 rounded-lg border-2 text-sm ${debugging ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'}`}
                >
                  {debugging ? '停止调试' : '开始调试'}
                </button>
                <button
                  onClick={() => debugStep()}
                  disabled={!debugging}
                  className="px-3 py-1.5 rounded-lg border-2 border-gray-200 text-gray-700 disabled:opacity-50 text-sm hover:bg-gray-100"
                >
                  单步
                </button>
                <button
                  onClick={() => debugContinue()}
                  disabled={!debugging}
                  className="px-3 py-1.5 rounded-lg border-2 border-gray-200 text-gray-700 disabled:opacity-50 text-sm hover:bg-gray-100"
                >
                  继续
                </button>
              </div>
            </div>
          </div>
          {debugging && (
            <div className="px-4 pt-3">
              <DebugInspector
                pausedLine={pausedLine}
                locals={(() => { try { return JSON.parse(localsView || '{}') } catch (_) { return {} } })()}
                stdout={outputText}
              />
            </div>
          )}
          {syntaxError ? (
            <div className="mx-4 mt-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-800 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold">语法错误</div>
                  <div className="text-sm break-words">{syntaxError.message}</div>
                  {syntaxError.line ? (
                    <div className="text-xs mt-1">位置：第 {syntaxError.line} 行</div>
                  ) : null}
                </div>
                <div className="flex-shrink-0">
                  <button
                    onClick={() => focusLine(syntaxError.line)}
                    className="px-3 py-1.5 rounded-lg bg-white border-2 border-red-200 text-red-700 hover:bg-red-100 text-sm"
                  >
                    定位到行
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div ref={outputRef} className="flex-1 overflow-auto bg-gray-50">
            {/* 图形输出区：Pixi 画布 + matplotlib 图片 */}
            <div className="p-4">
              <div
                className={`bg-white rounded-xl border-2 p-3 shadow-sm space-y-3 transition-shadow ${isOutputSelected ? 'border-blue-400 ring-2 ring-blue-300' : 'border-gray-200'}`}
                onClick={() => setIsOutputSelected(true)}
              >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-gray-700">图形输出</div>
                  <div className="ml-auto flex items-center gap-2">
                    {!isOutputMaximized ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setOverlayMounted(true); setIsOutputMaximized(true) }}
                        className="px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                        title="最大化图形输出"
                      >
                        ⛶ 最大化
                      </button>
                    ) : null}
                  </div>
                </div>
                {/* 始终渲染原始容器，最大化时它们会被置空（内容移动到全屏容器） */}
                <div
                  ref={gfxRootRef}
                  id="gfx-root"
                  className="w-full overflow-hidden rounded-lg border border-gray-200"
                  style={{ height: pixiVisible && !isOutputMaximized ? 480 : 0 }}
                ></div>
                <div ref={mplRootRef} id="mpl-root" className="w-full space-y-2"></div>
              </div>
            </div>
            {null}
            {/* 控制台输出区：Tabs: stdout / stderr / logs（简化为三块叠放，后续可加交互）*/}
            <div className="px-4 pb-4">
              <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm">
                <div className="border-b border-gray-200 px-3 pt-3">
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => setActiveConsoleTab('out')}
                      className={`px-3 py-1 rounded-t-lg border ${activeConsoleTab === 'out' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                    >输出</button>
                    <button
                      onClick={() => setActiveConsoleTab('err')}
                      className={`px-3 py-1 rounded-t-lg border ${activeConsoleTab === 'err' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                    >错误</button>
                    <button
                      onClick={() => setActiveConsoleTab('log')}
                      className={`px-3 py-1 rounded-t-lg border ${activeConsoleTab === 'log' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                    >日志</button>
                  </div>
                </div>
                <div className="p-4">
                  {activeConsoleTab === 'out' ? (
                    <pre className="m-0 text-gray-800 text-sm leading-6 font-mono whitespace-pre-wrap">{stdoutText || (pyodide ? "" : "# ⏳ 正在加载 Pyodide...")}</pre>
                  ) : null}
                  {activeConsoleTab === 'err' ? (
                    <>
                      {runError ? (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-800 px-3 py-2 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="font-semibold text-sm">运行错误</div>
                              <div className="text-xs break-words">{runError.message}</div>
                              {runError.line ? (
                                <div className="text-[11px] mt-1">位置：第 {runError.line} 行</div>
                              ) : null}
                            </div>
                            <div className="flex-shrink-0">
                              <button
                                onClick={() => focusLine(runError.line)}
                                className="px-2.5 py-1 rounded-md bg-white border border-red-200 text-red-700 hover:bg-red-100 text-xs"
                              >
                                定位到行
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <pre className="m-0 text-rose-700 text-sm leading-6 font-mono whitespace-pre-wrap">{stderrText}</pre>
                    </>
                  ) : null}
                  {activeConsoleTab === 'log' ? (
                    <pre className="m-0 text-gray-700 text-sm leading-6 font-mono whitespace-pre-wrap">{logsText}</pre>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
      {/* 图形输出 全屏覆盖层 */}
      {overlayMounted && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="absolute inset-0 p-4 flex flex-col">
            <div className="mb-3 flex items-center gap-2">
              <div className="text-base font-semibold text-white">图形输出（全屏）</div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleRun}
                  disabled={running}
                  className={`px-3 py-1.5 text-sm rounded-lg text-white shadow ${running ? 'bg-emerald-500/70 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                  title="运行代码 (Shift+Enter)"
                >
                  {running ? '运行中…' : '运行代码'}
                </button>
                <button
                  onClick={() => setIsOutputMaximized(false)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-white border-2 border-gray-200 text-gray-800 hover:bg-gray-100"
                >
                  还原
                </button>
              </div>
            </div>
            <div
              className={`flex-1 bg-white rounded-xl border-2 ${isOutputSelected ? 'border-blue-400 ring-2 ring-blue-300' : 'border-gray-200'}`}
              onClick={() => setIsOutputSelected(true)}
            >
              <div className="h-full w-full p-3 flex flex-col gap-3">
                <div
                  ref={fullscreenGfxRef}
                  id="gfx-root-fullscreen"
                  className="w-full overflow-hidden rounded-lg border border-gray-200"
                  style={{ height: pixiVisible ? 'calc(100vh - 220px)' : 0 }}
                ></div>
                <div ref={fullscreenMplRef} id="mpl-root-fullscreen" className="w-full flex-1 overflow-auto space-y-2"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


