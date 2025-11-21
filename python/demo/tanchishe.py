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
    "last_key": None,     # 最近一次按键（提高方向响应）
    "dirBuffer": None,    # 下一步方向缓冲（一次性应用）
    "keydown_cb": None,
    "keyup_cb": None,
    "click_cb": None,
    "ticker_cb": None,
    "acc": 0.0,           # 累积时间(ms)用于固定步长
    "tick_ms": 180,       # 每步逻辑间隔（适当降低速度）
    "cols": 20, "rows": 15, "cell": 32,
    "snake": [], "dir": (1, 0), "pending": (1, 0),
    "food": None, "score": 0, "over": False,
    "alerted": False,     # 防止重复弹窗
    # UI 覆盖层
    "ui_g": None,
    "ui_text": None,
    "ui_visible": False,
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
        S["last_key"] = code
        # 方向输入缓冲（边沿触发）：把期望方向存到 dirBuffer，下一步应用
        try:
            ax, ay = 0, 0
            if code in ("ArrowUp", "KeyW"): ax, ay = 0, -1
            elif code in ("ArrowDown", "KeyS"): ax, ay = 0, 1
            elif code in ("ArrowLeft", "KeyA"): ax, ay = -1, 0
            elif code in ("ArrowRight", "KeyD"): ax, ay = 1, 0
            else:
                ax, ay = 0, 0
            if ax != 0 or ay != 0:
                # 反向保护：禁止和当前方向相反
                cur_dx, cur_dy = S["dir"]
                if (ax, ay) == (-cur_dx, -cur_dy):
                    return
                # 紧贴保护：与头-次节方向相同也忽略（等价于反向保护的另一视角）
                if len(S["snake"]) >= 2:
                    hx, hy = S["snake"][0]
                    sx, sy = S["snake"][1]
                    if (ax, ay) == (hx - sx, hy - sy):
                        return
                S["dirBuffer"] = (ax, ay)
        except Exception:
            pass

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
        # 钳制单帧最大步长，避免掉帧导致瞬时大步推进引起“过快、输入滞后”的错觉
        if delta_ms > 50:
            delta_ms = 50
        S["acc"] += float(delta_ms)
        while S["acc"] >= S["tick_ms"]:
            S["acc"] -= S["tick_ms"]
            step_once()
        render()

    S["ticker_cb"] = create_proxy(on_tick)
    # 确保 ticker 启动（部分环境可能默认暂停）
    try:
        if hasattr(app.ticker, "start"):
            app.ticker.start()
    except Exception:
        pass
    app.ticker.add(S["ticker_cb"])
    print("✅ 贪吃蛇启动：方向键/WASD 控制，Game Over 后按 R 重开。请先在画布区域点一下以获取焦点。")

def init_game():
    S["snake"] = [(S["cols"]//2 + i, S["rows"]//2) for i in range(0, 3)][::-1]
    S["dir"] = (1, 0)
    S["pending"] = (1, 0)
    S["food"] = None
    S["score"] = 0
    S["over"] = False
    S["alerted"] = False
    hide_game_over_dialog()
    spawn_food()

def spawn_food():
    used = set(S["snake"])
    empty = [(x, y) for x in range(S["cols"]) for y in range(S["rows"]) if (x, y) not in used]
    if not empty:
        S["over"] = True
        return
    # 随机挑选一个空格；若恰好与蛇头相等（理论不会发生），则再挑一次
    idx = window.Math.floor(window.Math.random() * len(empty))
    candidate = empty[idx]
    if candidate == S["snake"][0] and len(empty) > 1:
        idx2 = (idx + 1) % len(empty)
        candidate = empty[idx2]
    S["food"] = candidate

def read_input():
    nx, ny = S["pending"]
    keys = S["keys"]

    def set_dir(ax, ay):
        nonlocal nx, ny
        # 禁止直接反向（与当前方向相反）
        cur_dx, cur_dy = S["dir"]
        if len(S["snake"]) >= 2 and (ax, ay) == (-cur_dx, -cur_dy):
            return
        # 原有基于头-次节向量的保护，双保险
        if len(S["snake"]) >= 2:
            hx, hy = S["snake"][0]
            sx, sy = S["snake"][1]
            if (ax, ay) == (hx - sx, hy - sy):
                return
        nx, ny = ax, ay

    # 优先应用一次性方向缓冲（保证短按也能被下一步采纳）
    db = S.get("dirBuffer")
    if isinstance(db, tuple):
        set_dir(db[0], db[1])
        S["dirBuffer"] = None
    else:
        # 回退：按键集合长按逻辑
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
    # 边界环绕（穿墙）
    nx, ny = (hx + dx) % S["cols"], (hy + dy) % S["rows"]

    # 是否将要增长（吃到食物）
    will_grow = bool(S["food"] and (nx, ny) == S["food"]) 

    # 自身碰撞检测：允许移动到“当前尾巴”的位置（如果本轮不会增长，尾巴会移动走）
    tail = S["snake"][-1]
    body = set(S["snake"])  # 使用集合避免偶发误判
    hits_self = ((nx, ny) in body) and not ((nx, ny) == tail and not will_grow)
    if hits_self:
        S["over"] = True
        show_game_over_dialog()
        return

    # 前进
    S["snake"].insert(0, (nx, ny))
    if will_grow:
        S["score"] += 1
        spawn_food()  # 立即重新生成方块
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

    # 食物（若偶发为空且未结束，补发）
    if not S["food"] and not S["over"]:
        try:
            spawn_food()
        except Exception:
            pass
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

    # 绘制 UI 覆盖层（若可见）
    if S.get("ui_visible") and S.get("ui_g") is not None:
        try:
            # 保持尺寸一致
            pass
        except Exception:
            pass

def ensure_ui_created():
    if S.get("ui_g") is not None and S.get("ui_text") is not None:
        return
    try:
        # 半透明背景
        ui_g = PIXI.Graphics.new()
        ui_g.zIndex = 9999 if hasattr(ui_g, 'zIndex') else 0
        # 文本
        text = None
        try:
            # v7 风格
            text = PIXI.Text.new({
                "text": "",
                "style": { "fill": 0xffffff, "fontSize": 24, "align": "center", "fontFamily": "system-ui, -apple-system, Segoe UI, Roboto" }
            })
        except Exception:
            # v6 兼容
            text = PIXI.Text.new("", { "fill": 0xffffff, "fontSize": 24, "align": "center" })

        # 初次尺寸与位置
        try:
            # 背景绘制一次，后面显示前会重画
            ui_g.clear()
            ui_g.beginFill(0x000000, 0.6); ui_g.drawRect(0, 0, 640, 480); ui_g.endFill()
        except Exception:
            try:
                ui_g.rect(0, 0, 640, 480).fill({ "color": 0x000000, "alpha": 0.6 })
            except Exception:
                pass

        # 将文本大致置中
        try:
            text.x = 320 - 200
            text.y = 180
            text.style.wordWrap = True
            text.style.wordWrapWidth = 400
        except Exception:
            try:
                text.x = 120; text.y = 180
            except Exception:
                pass

        # 容器加入舞台
        S["app"].stage.addChild(ui_g)
        S["app"].stage.addChild(text)
        try:
            S["app"].stage.sortableChildren = True
        except Exception:
            pass

        S["ui_g"] = ui_g
        S["ui_text"] = text
        S["ui_visible"] = False
        set_ui_visible(False)
    except Exception:
        pass

def set_ui_visible(v):
    S["ui_visible"] = bool(v)
    try:
        if S["ui_g"]: S["ui_g"].visible = S["ui_visible"]
        if S["ui_text"]: S["ui_text"].visible = S["ui_visible"]
    except Exception:
        pass

def show_game_over_dialog():
    ensure_ui_created()
    # 更新背景尺寸（以防未来改了画布大小）
    try:
        g = S["ui_g"]
        g.clear()
        g.beginFill(0x000000, 0.6); g.drawRect(0, 0, 640, 480); g.endFill()
    except Exception:
        try:
            g = S["ui_g"]
            g.clear(); g.rect(0, 0, 640, 480).fill({ "color": 0x000000, "alpha": 0.6 })
        except Exception:
            pass
    # 更新文本
    try:
        msg = f"游戏结束\n得分：{S['score']}\n按 R 重新开始"
        t = S["ui_text"]
        try:
            t.text = msg
        except Exception:
            # v7 对象式文本
            t.text = msg
        set_ui_visible(True)
    except Exception:
        pass

def hide_game_over_dialog():
    try:
        set_ui_visible(False)
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