# 兼容 Pixi v7/v6 的最小自检（无 await / 无协程 / 不用 nonlocal）
from js import window, document
from pyodide.ffi import create_proxy

root = document.getElementById("gfx-root")
if root is None:
    print("❌ 未找到元素 #gfx-root"); raise SystemExit

# 触发你的页面里用于展开画布的事件（如果有的话）
try:
    evt = window.CustomEvent.new('fun-pixi-visible', { "detail": True })
    window.dispatchEvent(evt)
except Exception:
    pass

# 确保容器可见
root.style.display = ''
root.style.height = '480px'
root.style.overflow = 'hidden'

PIXI = getattr(window, "PIXI", None)
if PIXI is None:
    print("❌ window.PIXI 未加载"); raise SystemExit

init_opts = { "width": 640, "height": 480, "background": 0x1f2937, "antialias": True }

def start_after_init(app):
    root.innerHTML = ""
    canvas = getattr(app, "canvas", None) or getattr(app, "view", None)
    if canvas is None:
        print("❌ 未找到 canvas/view"); return
    root.appendChild(canvas)

    # 画矩形；将速度挂到图元对象上，避免 nonlocal
    g = PIXI.Graphics.new()
    ok = False
    try:
        g.beginFill(0x22c55e); g.drawRect(0,0,40,40); g.endFill(); ok = True
    except Exception:
        try:
            g.rect(0,0,40,40).fill(0x22c55e); ok = True
        except Exception:
            pass
    if not ok:
        print("⚠️ 无法创建矩形"); return

    g.x, g.y = 0, 220
    g.vx = 4  # 用属性存速度
    app.stage.addChild(g)

    def tick(_dt):
        g.x += g.vx
        if g.x < 0 or g.x + 40 > 640:
            g.vx = -g.vx
            g.x += g.vx

    app.ticker.add(create_proxy(tick))
    print("✅ 应看到绿色方块左右移动。")

# 构造并检测 v7/v6
try:
    app = PIXI.Application.new()
    if getattr(app, "init", None):
        # v7: 用 Promise.then 初始化
        def on_ok(_):
            start_after_init(app)
        app.init(init_opts).then(create_proxy(on_ok))
    else:
        # v6
        app = PIXI.Application.new(init_opts)
        start_after_init(app)
except Exception as e:
    # 兜底：按 v6 再试一次
    try:
        app = PIXI.Application.new(init_opts)
        start_after_init(app)
    except Exception as e2:
        print("❌ 创建应用失败：", e2)