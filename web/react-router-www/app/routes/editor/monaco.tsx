import * as React from "react"
import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"
import { useParams, useNavigate } from "react-router"
import Editor, { loader } from "@monaco-editor/react"

export default function MonacoEditorPage() {
  const { programId: routeProgramId } = useParams()
  const navigate = useNavigate()
  const [monacoConfig, setMonacoConfig] = React.useState<'local' | 'bundle' | 'cdn' | 'loading'>('loading')
  const [code, setCode] = React.useState<string>(
    [
      "# 绘制一个正弦函数图像",
      "import numpy as np",
      "import matplotlib.pyplot as plt",
      "",
      "x = np.linspace(0, 2*np.pi, 400)",
      "y = np.sin(x)",
      "",
      "plt.figure(figsize=(6, 3))",
      "plt.plot(x, y)",
      "plt.title('y = sin(x)')",
      "plt.grid(True)",
      "",
      "# 运行后右侧会显示图像，也可以在下方看到标准输出",
      "print('绘图完成')",
    ].join("\n")
  )
  const [pyodide, setPyodide] = React.useState<any>(null)
  const [outputText, setOutputText] = React.useState<string>("")
  const [outputImage, setOutputImage] = React.useState<string>("")
  const [running, setRunning] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [programName, setProgramName] = React.useState<string>("未命名程序")
  const [programId, setProgramId] = React.useState<number | null>(null)
  const [syntaxError, setSyntaxError] = React.useState<{ message: string; line?: number } | null>(null)
  const [runError, setRunError] = React.useState<{ message: string; line?: number } | null>(null)
  const outputRef = React.useRef<HTMLDivElement>(null)
  const programType = "python"
  const editorRef = React.useRef<any>(null)
  const monacoRef = React.useRef<any>(null)
  // 调试相关
  const [debugging, setDebugging] = React.useState(false)
  const [pausedLine, setPausedLine] = React.useState<number | null>(null)
  const [localsView, setLocalsView] = React.useState<string>("")
  const [breakpoints, setBreakpoints] = React.useState<Set<number>>(new Set())
  const [bpDecorations, setBpDecorations] = React.useState<string[]>([])

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
      .paused-line { background: rgba(59, 130, 246, 0.15) !important; }
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

  const handleRun = React.useCallback(async () => {
    if (!pyodide) {
      setOutputText("Pyodide 加载中，请稍候...")
      return
    }
    setRunning(true)
    setSyntaxError(null)
    setRunError(null)
    setOutputText("")
    setOutputImage("")
    try {
      const wrapped = `\nimport sys, io, traceback, base64\nout_buffer = io.StringIO()\nerr_buffer = io.StringIO()\n_sys_stdout = sys.stdout\n_sys_stderr = sys.stderr\nsys.stdout = out_buffer\nsys.stderr = err_buffer\nns = {}\nimg_b64 = ""\ntry:\n    exec(${JSON.stringify(code)}, ns)\n    try:\n        import matplotlib.pyplot as plt\n        if plt.get_fignums():\n            bio = io.BytesIO()\n            plt.savefig(bio, format='png', dpi=150, bbox_inches='tight')\n            bio.seek(0)\n            img_b64 = 'data:image/png;base64,' + base64.b64encode(bio.read()).decode('ascii')\n            plt.close('all')\n    except Exception:\n        pass\nexcept Exception as e:\n    traceback.print_exc()\nfinally:\n    sys.stdout = _sys_stdout\n    sys.stderr = _sys_stderr\nres = {'stdout': out_buffer.getvalue(), 'stderr': err_buffer.getvalue(), 'image': img_b64}\nimport json\njson.dumps(res)\n`
      const json = await pyodide.runPythonAsync(wrapped)
      try {
        const parsed = JSON.parse(String(json))
        const s = String(parsed.stdout || "")
        const e = String(parsed.stderr || "")
        const outCombined = e ? (s ? (s + "\n" + e) : e) : s
        setOutputText(outCombined)
        setOutputImage(String(parsed.image || ""))
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
  }, [pyodide, code])

  const handleClear = () => {
    setOutputText("")
    setOutputImage("")
    setSyntaxError(null)
    setRunError(null)
  }

  const handleNew = () => {
    // 重置所有状态
    setCode([
      "# 新建 Python 程序",
      "import numpy as np",
      "import matplotlib.pyplot as plt",
      "",
      "# 在这里编写你的代码",
      "print('Hello, World!')",
    ].join("\n"))
    setProgramName("未命名程序")
    setProgramId(null)
    setOutputText("")
    setOutputImage("")
    setSyntaxError(null)
    setRunError(null)
    setMenuOpen(false)
    
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
            }
            // 保存成功后跳转到打开页面
            if (typeof returnedId === "number") {
              navigate(`/www/user/programs/open/${returnedId}`, { replace: true })
            }
          }
        } catch (_) {}
        setMenuOpen(false)
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
  }, [code, programName, programId])

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
        } else {
          console.log("程序名称为空或无效:", programData?.name)
        }
        
        // 加载程序代码
        if (programData && typeof programData.program === "string") {
          console.log("设置程序代码，长度:", programData.program.length)
          setCode(programData.program)
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

      // 点击行号/边距切换断点
      try {
        editor.onMouseDown((e: any) => {
          if (e.target?.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS ||
              e.target?.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
              e.target?.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
            const line = e.target.position?.lineNumber
            if (!line) return
            const next = new Set(breakpoints)
            if (next.has(line)) next.delete(line); else next.add(line)
            setBreakpoints(next)
            refreshBreakpointDecorations(editor, monaco, next)
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

  // 断点装饰刷新与暂停标记
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
      const applied = editor.deltaDecorations(bpDecorations, decos)
      setBpDecorations(applied)
    } catch (_) {}
  }

  function markPaused(editor: any, monaco: any, line?: number | null) {
    try {
      const ranges = [] as any[]
      if (line) {
        ranges.push({
          range: new monaco.Range(line, 1, line, 1),
          options: { isWholeLine: true, className: 'paused-line', glyphMarginClassName: 'current-glyph' },
        })
      }
      const applied = editor.deltaDecorations(bpDecorations, ranges)
      setBpDecorations(applied)
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
      if (editor && monaco) markPaused(editor, monaco, null)
      setDebugging(true)
      setPausedLine(null)
      setLocalsView('未设置断点。点击左侧添加断点，然后使用“继续/单步”。')
    }
  }

  function debugStop() {
    setDebugging(false)
    setPausedLine(null)
    setLocalsView("")
    const editor = editorRef.current, monaco = monacoRef.current
    if (editor && monaco) markPaused(editor, monaco, null)
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
      markPaused(editor, monaco, st.line || null)
    } else {
      setPausedLine(null)
      setLocalsView("")
      markPaused(editor, monaco, null)
    }
  }

  async function debugStep() {
    if (!debugging) return
    await debugContinue(true)
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="h-16 px-6 flex items-center justify-between border-b-2 border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-4">
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
                  className="w-full text-left px-4 py-3 hover:bg-purple-50 rounded-b-xl transition-colors duration-200"
                  onClick={handleSave}
                >
                  💾 保存
                </button>
              </div>
            ) : null}
          </div>
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
          </div>
        </div>
        <div className="flex items-center gap-3">
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
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-1/2 md:w-3/5 h-full border-r-2 border-gray-200 bg-white">
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

        <div className="w-1/2 md:w-2/5 h-full flex flex-col bg-white">
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
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-900 px-4 py-3 shadow-sm">
                <div className="text-sm font-semibold">调试状态 {pausedLine ? `(行 ${pausedLine})` : ''}</div>
                <pre className="text-xs whitespace-pre-wrap mt-1">{localsView || '无变量'}</pre>
              </div>
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
            {runError ? (
              <div className="p-4 pt-3">
                <div className="rounded-xl border-2 border-red-200 bg-red-50 text-red-800 px-4 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold">运行错误</div>
                      <div className="text-sm break-words">{runError.message}</div>
                      {runError.line ? (
                        <div className="text-xs mt-1">位置：第 {runError.line} 行</div>
                      ) : null}
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => focusLine(runError.line)}
                        className="px-3 py-1.5 rounded-lg bg-white border-2 border-red-200 text-red-700 hover:bg-red-100 text-sm"
                      >
                        定位到行
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {outputImage ? (
              <div className="p-4">
                <div className="bg-white rounded-xl border-2 border-gray-200 p-4 shadow-sm">
                  <img src={outputImage} className="max-w-full h-auto rounded-lg" />
                </div>
              </div>
            ) : null}
            <div className="p-4">
              <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm">
                <pre className="m-0 p-4 text-gray-800 text-sm leading-6 font-mono whitespace-pre-wrap">
{outputText || (pyodide ? "# 🎯 运行后图像/输出将显示在这里\n# 💡 提示：使用 Shift+Enter 快速运行代码" : "# ⏳ 正在加载 Pyodide，首次加载需要一点时间...\n# 📦 正在下载 Python 科学计算包")}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


