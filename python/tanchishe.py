# 直接使用 PIXI 的彩色方块贪吃蛇（v7/v6 兼容、无 await/协程、键盘可控）
# 方向键：↑ ↓ ← → 或 WASD；Game Over 后按 R 重开

from js import window, document
from pyodide.ffi import create_proxy

root = document.getElementById("gfx-root")
if root is None:
    print("❌ 未找到元素 #gfx-root"); raise SystemExit

# 触发你页面里用于展开画布的事件（如果 React 在监听）
try:
    evt = window.CustomEvent.new('fun-pixi-visible', { "detail": True })
    window.dispatchEvent(evt)
except Exception:
    pass

# 确保可见且可聚焦
root.style.display = ''
root.style.height = '480px'
root.style.overflow = 'hidden'
root.tabIndex = 0
root.style.outline = "none"

PIXI = getattr(window, "PIXI", None)
if PIXI is None:
    print("❌ window.PIXI 未加载"); raise SystemExit

init_opts = { "width": 640, "height": 480, "background": 0x111827, "antialias": True }

# 全局状态，避免 nonlocal/global 的坑
S = {
    "app": None,
    "g": None,            # 重用的 Graphics
    "keys": set(),        # 键盘集合
    "keydown_cb": None,
    "keyup_cb": None,
    "click_cb": None,
    "ticker_cb": None,
    "acc": 0.0,           # 累积时间(ms)用于固定步长
    "tick_ms": 120,       # 每步逻辑间隔
    "cols": 20, "rows": 15, "cell": 32,
    "snake": [], "dir": (1, 0), "pending": (1, 0),
    "food": None, "score": 0, "over": False,
}

def setup_keyboard():
    # 点击画布区域获取焦点，降低 Monaco 抢焦点影响
    def on_focus_container(_e):
        root.focus()
    S["click_cb"] = create_proxy(on_focus_container)
    root.addEventListener("mousedown", S["click_cb"])
    root.addEventListener("touchstart", S["click_cb"])

    # 键盘监听（捕获阶段 + 阻止默认），支持 Arrow 与 WASD
    def on_down(e):
        code = e.code or e.key
        if code in ("ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD","KeyR"):
            try: e.preventDefault()
            except: pass
        S["keys"].add(code)

    def on_up(e):
        code = e.code or e.key
        S["keys"].discard(code)

    S["keydown_cb"] = create_proxy(on_down)
    S["keyup_cb"]   = create_proxy(on_up)
    # 捕获阶段，避免被 Monaco 阻止冒泡
    window.addEventListener("keydown", S["keydown_cb"], { "capture": True })
    window.addEventListener("keyup",   S["keyup_cb"],   { "capture": True })

def teardown_keyboard():
    try:
        if S["keydown_cb"]:
            window.removeEventListener("keydown", S["keydown_cb"], { "capture": True })
            S["keydown_cb"] = None
    except Exception:
        pass
    try:
        if S["keyup_cb"]:
            window.removeEventListener("keyup", S["keyup_cb"], { "capture": True })
            S["keyup_cb"] = None
    except Exception:
        pass
    try:
        if S["click_cb"]:
            root.removeEventListener("mousedown", S["click_cb"])
            root.removeEventListener("touchstart", S["click_cb"])
            S["click_cb"] = None
    except Exception:
        pass

def setup_app_and_start(app):
    S["app"] = app
    root.innerHTML = ""
    canvas = getattr(app, "canvas", None) or getattr(app, "view", None)
    root.appendChild(canvas)

    # 复用一个 Graphics，每帧清空重画
    S["g"] = PIXI.Graphics.new()
    app.stage.addChild(S["g"])

    setup_keyboard()
    init_game()

    # 固定步长逻辑 + 每帧渲染
    def on_tick(_dt):
        delta_ms = app.ticker.deltaMS if hasattr(app.ticker, "deltaMS") else 16.7
        S["acc"] += float(delta_ms)
        while S["acc"] >= S["tick_ms"]:
            S["acc"] -= S["tick_ms"]
            step_once()
        render()

    S["ticker_cb"] = create_proxy(on_tick)
    app.ticker.add(S["ticker_cb"])
    print("✅ 贪吃蛇启动：方向键/WASD 控制，Game Over 后按 R 重开。请先在画布区域点一下以获取焦点。")

def init_game():
    S["snake"] = [(S["cols"]//2 + i, S["rows"]//2) for i in range(0, 3)][::-1]
    S["dir"] = (1, 0)
    S["pending"] = (1, 0)
    S["food"] = None
    S["score"] = 0
    S["over"] = False
    spawn_food()

def spawn_food():
    used = set(S["snake"])
    empty = [(x, y) for x in range(S["cols"]) for y in range(S["rows"]) if (x, y) not in used]
    if not empty:
        S["over"] = True
        return
    idx = window.Math.floor(window.Math.random() * len(empty))
    S["food"] = empty[idx]

def read_input():
    nx, ny = S["pending"]
    keys = S["keys"]

    def set_dir(ax, ay):
        nonlocal nx, ny
        if len(S["snake"]) >= 2:
            hx, hy = S["snake"][0]
            sx, sy = S["snake"][1]
            if (ax, ay) == (hx - sx, hy - sy):
                return
        nx, ny = ax, ay

    if ("ArrowUp" in keys) or ("KeyW" in keys):    set_dir(0, -1)
    elif ("ArrowDown" in keys) or ("KeyS" in keys): set_dir(0, 1)
    elif ("ArrowLeft" in keys) or ("KeyA" in keys): set_dir(-1, 0)
    elif ("ArrowRight" in keys) or ("KeyD" in keys):set_dir(1, 0)

    S["pending"] = (nx, ny)

def step_once():
    if S["over"]:
        # R 重开
        if "KeyR" in S["keys"]:
            init_game()
        return

    read_input()
    S["dir"] = S["pending"]
    dx, dy = S["dir"]
    hx, hy = S["snake"][0]
    nx, ny = hx + dx, hy + dy

    # 碰撞检测：边界/自身
    if nx < 0 or nx >= S["cols"] or ny < 0 or ny >= S["rows"] or (nx, ny) in S["snake"]:
        S["over"] = True
        return

    S["snake"].insert(0, (nx, ny))
    if S["food"] and (nx, ny) == S["food"]:
        S["score"] += 1
        spawn_food()
    else:
        S["snake"].pop()

def render():
    g = S["g"]
    g.clear()

    # 背景
    try:
        g.beginFill(0x111827); g.drawRect(0, 0, 640, 480); g.endFill()
    except Exception:
        try:
            g.rect(0, 0, 640, 480).fill(0x111827)
        except Exception:
            pass

    # 食物
    if S["food"]:
        fx, fy = S["food"]
        x, y = fx*S["cell"]+2, fy*S["cell"]+2
        try:
            g.beginFill(0xef4444); g.drawRect(x, y, S["cell"]-4, S["cell"]-4); g.endFill()
        except Exception:
            try:
                g.rect(x, y, S["cell"]-4, S["cell"]-4).fill(0xef4444)
            except Exception:
                pass

    # 蛇
    for i, (sx, sy) in enumerate(S["snake"]):
        x, y = sx*S["cell"]+2, sy*S["cell"]+2
        color = 0x16a34a if i == 0 else 0x22c55e
        try:
            g.beginFill(color); g.drawRect(x, y, S["cell"]-4, S["cell"]-4); g.endFill()
        except Exception:
            try:
                g.rect(x, y, S["cell"]-4, S["cell"]-4).fill(color)
            except Exception:
                pass

# 创建应用（v7 优先 / v6 回退）
try:
    app = PIXI.Application.new()
    if getattr(app, "init", None):
        # v7：Promise 初始化
        def on_ok(_):
            setup_app_and_start(app)
        app.init(init_opts).then(create_proxy(on_ok))
    else:
        # v6：构造即初始化
        app = PIXI.Application.new(init_opts)
        setup_app_and_start(app)
except Exception:
    # 兜底：按 v6 再试一次
    app = PIXI.Application.new(init_opts)
    setup_app_and_start(app)