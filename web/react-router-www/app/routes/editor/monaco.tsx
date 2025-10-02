import * as React from "react"
import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"
import { useParams, useNavigate } from "react-router"

export default function MonacoEditorPage() {
  const { programId: routeProgramId } = useParams()
  const navigate = useNavigate()
  const [Editor, setEditor] = React.useState<any>(null)
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
  const programType = "python"
  const editorRef = React.useRef<any>(null)
  const monacoRef = React.useRef<any>(null)

  // 动态加载 Monaco 编辑器（仅客户端）
  React.useEffect(() => {
    let active = true
    if (typeof window !== "undefined") {
      import("@monaco-editor/react")
        .then((mod) => active && setEditor(() => mod.default))
        .catch(() => setEditor(null))
    }
    return () => {
      active = false
    }
  }, [])

  // 动态加载 Pyodide（仅客户端）
  React.useEffect(() => {
    let mounted = true
    async function loadPyodideOnce() {
      if ((window as any).loadPyodide && mounted) {
        const py = await (window as any).loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
        })
        // 预加载绘图与科学计算常用包
        try {
          await py.loadPackage(["matplotlib", "numpy"]) 
        } catch (_) {}
        if (mounted) setPyodide(py)
        return
      }
      const script = document.createElement("script")
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"
      script.async = true
      script.onload = async () => {
        try {
          const py = await (window as any).loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
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
    setOutputText("")
    setOutputImage("")
    try {
      const wrapped = `\nimport sys, io, traceback, base64\n_buffer = io.StringIO()\n_sys_stdout = sys.stdout\nsys.stdout = _buffer\nns = {}\nimg_b64 = ""\ntry:\n    exec(${JSON.stringify(code)}, ns)\n    try:\n        import matplotlib.pyplot as plt\n        if plt.get_fignums():\n            bio = io.BytesIO()\n            plt.savefig(bio, format='png', dpi=150, bbox_inches='tight')\n            bio.seek(0)\n            img_b64 = 'data:image/png;base64,' + base64.b64encode(bio.read()).decode('ascii')\n            plt.close('all')\n    except Exception:\n        pass\nexcept Exception as e:\n    traceback.print_exc()\nfinally:\n    sys.stdout = _sys_stdout\nres = {'stdout': _buffer.getvalue(), 'image': img_b64}\nimport json\njson.dumps(res)\n`
      const json = await pyodide.runPythonAsync(wrapped)
      try {
        const parsed = JSON.parse(String(json))
        setOutputText(String(parsed.stdout || ""))
        setOutputImage(String(parsed.image || ""))
      } catch (e) {
        setOutputText(String(json || ""))
      }
    } catch (e: any) {
      setOutputText(String(e?.message || e || "运行出错"))
    } finally {
      setRunning(false)
    }
  }, [pyodide, code])

  const handleClear = () => {
    setOutputText("")
    setOutputImage("")
  }

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

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 text-gray-100">
      {/* 顶部工具栏 */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-gray-800 bg-gray-900/90">
        <div className="flex items-center gap-3">
          <div className="relative" data-menu="file-menu">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700"
            >
            文件 ▾
            </button>
            {menuOpen ? (
              <div className="absolute mt-1 min-w-[160px] rounded-md border border-gray-800 bg-gray-900 shadow-lg z-10">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-slate-800"
                  onClick={handleRename}
                >
                  重命名
                </button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-slate-800"
                  onClick={handleSave}
                >
                  保存
                </button>
              </div>
            ) : null}
          </div>
          <div className="font-medium">
            {programName || "未命名程序"} - Monaco + Pyodide
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
          >
            {running ? "运行中..." : "运行 (Shift+Enter)"}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600"
          >
            清空输出
          </button>
        </div>
      </div>

      {/* 主体两栏布局 */}
      <div className="flex h-[calc(100vh-3rem)]">
        <div className="w-1/2 md:w-3/5 h-full border-r border-gray-800">
          {Editor ? (
            <Editor
              height="100%"
              defaultLanguage="python"
              value={code}
              onChange={(v: any) => setCode(v ?? "")}
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                automaticLayout: true,
                wordWrap: "on",
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              正在加载编辑器...
            </div>
          )}
        </div>

        <div className="w-1/2 md:w-2/5 h-full flex flex-col">
          <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-400 border-b border-gray-800">
            结果 / Result
          </div>
          <div className="flex-1 overflow-auto bg-gray-950">
            {outputImage ? (
              <div className="p-3">
                <img src={outputImage} className="max-w-full h-auto rounded-md border border-gray-800" />
              </div>
            ) : null}
            <pre className="m-0 p-4 text-gray-100 text-sm leading-6">
{outputText || (pyodide ? "# 运行后图像/输出将显示在这里" : "# 正在加载 Pyodide，首次加载需要一点时间...")}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}


