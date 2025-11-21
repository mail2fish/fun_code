"""
MiniEngine - 一个面向网页（PIXI + Pyodide）的超轻量 Python 游戏小框架。

目标：
- 小朋友也能读懂、能改、能做出自己的网页小游戏。
- 参考 Unity/Unreal/Cocos 的常见概念：Game、Scene、Node、Update Loop。

使用方式（最小示例）：
from mini_engine import Game, Scene, RectNode

class MyScene(Scene):
    def on_start(self):
        self.player = RectNode(300, 220, 40, 40, 0x22c55e)
        self.add(self.player)

    def on_update(self, dt):
        speed = 180
        dx = (self.game.input.axis_right() - self.game.input.axis_left()) * speed * dt
        dy = (self.game.input.axis_down() - self.game.input.axis_up()) * speed * dt
        self.player.x += dx
        self.player.y += dy

game = Game(width=640, height=480)
game.start(MyScene())

注意：
- 需要网页中存在 id 为 "gfx-root" 的元素，且全局已加载 PIXI。
- 运行环境为浏览器 + Pyodide。
"""

from js import window, document
from pyodide.ffi import create_proxy


# 全局 PIXI 引用
PIXI = getattr(window, "PIXI", None)
if PIXI is None:
    print("❌ window.PIXI 未加载，如在网页中请先引入 PIXI。")


def _get_root_element():
    root = document.getElementById("gfx-root")
    if root is None:
        print("❌ 未找到元素 #gfx-root")
        return None
    # 让它可见与可聚焦
    root.style.display = ''
    root.style.height = '480px'
    root.style.overflow = 'hidden'
    root.tabIndex = 0
    root.style.outline = "none"
    return root


class Input:
    """简单输入系统：记录按键按下/抬起状态，并提供方向轴。"""

    def __init__(self, root):
        self.root = root
        self._keys_down = set()
        self._keys_pressed = set()  # 本帧新按下
        self._keys_released = set()  # 本帧抬起
        self._down_cb = None
        self._up_cb = None
        self._click_cb = None

    def setup(self):
        def on_focus(_e):
            try:
                self.root.focus()
            except Exception:
                pass

        def on_down(e):
            code = e.code or e.key
            if code in ("ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD","Space"):  # 可扩展
                try:
                    e.preventDefault()
                except Exception:
                    pass
            if code not in self._keys_down:
                self._keys_pressed.add(code)
            self._keys_down.add(code)

        def on_up(e):
            code = e.code or e.key
            if code in self._keys_down:
                self._keys_released.add(code)
            self._keys_down.discard(code)

        self._click_cb = create_proxy(on_focus)
        self.root.addEventListener("mousedown", self._click_cb)
        self.root.addEventListener("touchstart", self._click_cb)

        self._down_cb = create_proxy(on_down)
        self._up_cb = create_proxy(on_up)
        window.addEventListener("keydown", self._down_cb, { "capture": True })
        window.addEventListener("keyup",   self._up_cb,   { "capture": True })

    def teardown(self):
        try:
            if self._down_cb:
                window.removeEventListener("keydown", self._down_cb, { "capture": True })
        except Exception:
            pass
        try:
            if self._up_cb:
                window.removeEventListener("keyup", self._up_cb, { "capture": True })
        except Exception:
            pass
        try:
            if self._click_cb:
                self.root.removeEventListener("mousedown", self._click_cb)
                self.root.removeEventListener("touchstart", self._click_cb)
        except Exception:
            pass
        self._down_cb = None
        self._up_cb = None
        self._click_cb = None

    # 每帧调用，清理“本帧事件”
    def _end_frame(self):
        self._keys_pressed.clear()
        self._keys_released.clear()

    # 查询接口
    def is_down(self, code: str) -> bool:
        return code in self._keys_down

    def was_pressed(self, code: str) -> bool:
        return code in self._keys_pressed

    def was_released(self, code: str) -> bool:
        return code in self._keys_released

    # 常见方向轴（返回 0 或 1）
    def axis_left(self) -> int:
        return 1 if ("ArrowLeft" in self._keys_down or "KeyA" in self._keys_down) else 0

    def axis_right(self) -> int:
        return 1 if ("ArrowRight" in self._keys_down or "KeyD" in self._keys_down) else 0

    def axis_up(self) -> int:
        return 1 if ("ArrowUp" in self._keys_down or "KeyW" in self._keys_down) else 0

    def axis_down(self) -> int:
        return 1 if ("ArrowDown" in self._keys_down or "KeyS" in self._keys_down) else 0


class Node:
    """场景中的节点（可以有子节点），包含位置与可选的渲染对象。"""

    def __init__(self, x: float = 0, y: float = 0):
        self.x = float(x)
        self.y = float(y)
        self.children = []
        self.parent = None
        self._display = None  # PIXI 显示对象（可选）

    # 生命周期钩子
    def on_added(self):
        pass

    def on_removed(self):
        pass

    def on_update(self, dt: float):
        pass

    def _attach_to_stage(self, stage):
        if self._display is not None:
            try:
                stage.addChild(self._display)
            except Exception:
                pass
        for c in self.children:
            c._attach_to_stage(stage)

    def _detach_from_stage(self, stage):
        for c in self.children:
            c._detach_from_stage(stage)
        if self._display is not None:
            try:
                stage.removeChild(self._display)
            except Exception:
                pass

    def add(self, node: "Node"):
        if node.parent is not None:
            node.parent.remove(node)
        node.parent = self
        self.children.append(node)
        node.on_added()
        # 若在运行中，需要把显示对象加入舞台，由 Scene 负责

    def remove(self, node: "Node"):
        if node in self.children:
            self.children.remove(node)
            node.parent = None
            node.on_removed()

    def _update_tree(self, dt: float):
        self.on_update(dt)
        # 更新显示对象的位置（若有）
        if self._display is not None:
            try:
                self._display.x = self.x
                self._display.y = self.y
            except Exception:
                pass
        for c in list(self.children):
            c._update_tree(dt)


class Scene(Node):
    """场景：继承 Node，并作为树根。"""

    def __init__(self):
        super().__init__(0, 0)
        self.game = None  # 运行时由 Game 注入

    def on_start(self):
        """首次进入场景时调用。"""
        pass

    def on_exit(self):
        """离开场景时调用。"""
        pass


class RectNode(Node):
    """矩形节点：用于画一个彩色方块。"""

    def __init__(self, x: float, y: float, w: float, h: float, color: int = 0xffffff):
        super().__init__(x, y)
        self.width = float(w)
        self.height = float(h)
        self.color = int(color)
        g = PIXI.Graphics.new()
        try:
            g.beginFill(self.color)
            g.drawRect(0, 0, self.width, self.height)
            g.endFill()
        except Exception:
            try:
                g.rect(0, 0, self.width, self.height).fill(self.color)
            except Exception:
                pass
        self._display = g


class CircleNode(Node):
    """圆形节点。"""

    def __init__(self, x: float, y: float, radius: float, color: int = 0xffffff):
        super().__init__(x, y)
        self.radius = float(radius)
        self.color = int(color)
        g = PIXI.Graphics.new()
        try:
            g.beginFill(self.color)
            g.drawCircle(0, 0, self.radius)
            g.endFill()
        except Exception:
            try:
                g.circle(0, 0, self.radius).fill(self.color)
            except Exception:
                pass
        self._display = g


class TextNode(Node):
    """文本节点。"""

    def __init__(self, x: float, y: float, text: str, color: int = 0xffffff, size: int = 18):
        super().__init__(x, y)
        # v7 对象式，v6 字符串式，两种都尝试
        t = None
        try:
            t = PIXI.Text.new({
                "text": text,
                "style": { "fill": color, "fontSize": size, "fontFamily": "system-ui, -apple-system, Segoe UI, Roboto" }
            })
        except Exception:
            try:
                t = PIXI.Text.new(text, { "fill": color, "fontSize": size })
            except Exception:
                t = None
        self._display = t
        self.text = text

    def set_text(self, s: str):
        self.text = s
        t = self._display
        if t is None:
            return
        try:
            t.text = s
        except Exception:
            try:
                t.text = s
            except Exception:
                pass


class Game:
    """Game：管理 PIXI 应用、输入、主循环与场景切换。"""

    def __init__(self, width: int = 640, height: int = 480, background: int = 0x111827, antialias: bool = True):
        self.width = int(width)
        self.height = int(height)
        self.background = int(background)
        self.antialias = bool(antialias)

        self.root = _get_root_element()
        self.app = None
        self._ticker_cb = None
        self._acc = 0.0
        self.fixed_ms = 16.6667  # 60fps

        self.input = Input(self.root)
        self.scene = None

        # 触发外部页面的“画布可见”事件（若页面在监听）
        try:
            evt = window.CustomEvent.new('fun-pixi-visible', { "detail": True })
            window.dispatchEvent(evt)
        except Exception:
            pass

    def _create_app(self):
        if PIXI is None or self.root is None:
            return
        opts = { "width": self.width, "height": self.height, "background": self.background, "antialias": self.antialias }
        try:
            app = PIXI.Application.new()
            if getattr(app, "init", None):
                def on_ok(_):
                    self._on_app_ready(app)
                app.init(opts).then(create_proxy(on_ok))
                self.app = app
                return
            else:
                app = PIXI.Application.new(opts)
                self.app = app
                self._on_app_ready(app)
        except Exception:
            # 兜底按 v6 再试一次
            app = PIXI.Application.new(opts)
            self.app = app
            self._on_app_ready(app)

    def _on_app_ready(self, app):
        self.root.innerHTML = ""
        canvas = getattr(app, "canvas", None) or getattr(app, "view", None)
        if canvas is not None:
            self.root.appendChild(canvas)

        self.input.setup()

        def on_tick(_dt):
            # 使用 deltaMS，限制单帧最大步长
            delta_ms = app.ticker.deltaMS if hasattr(app.ticker, "deltaMS") else 16.7
            if delta_ms > 50:
                delta_ms = 50
            dt = float(delta_ms) / 1000.0
            # 场景更新
            if self.scene is not None:
                self.scene._update_tree(dt)
            # 结束帧（清理 just-pressed 等）
            self.input._end_frame()

        self._ticker_cb = create_proxy(on_tick)
        try:
            if hasattr(app.ticker, "start"):
                app.ticker.start()
        except Exception:
            pass
        app.ticker.add(self._ticker_cb)

    def start(self, scene: "Scene"):
        """启动游戏并切换到指定场景。"""
        self._create_app()
        self.change_scene(scene)

    def change_scene(self, scene: "Scene"):
        # 卸载旧场景
        if self.scene is not None and self.app is not None:
            try:
                self.scene.on_exit()
                self.scene._detach_from_stage(self.app.stage)
            except Exception:
                pass

        # 安装新场景
        self.scene = scene
        if self.scene is not None:
            self.scene.game = self
            if self.app is not None:
                self.scene._attach_to_stage(self.app.stage)
            try:
                self.scene.on_start()
            except Exception:
                pass

    def stop(self):
        if self.app is None:
            return
        try:
            if self._ticker_cb:
                self.app.ticker.remove(self._ticker_cb)
        except Exception:
            pass
        self._ticker_cb = None
        try:
            if hasattr(self.app.ticker, "stop"):
                self.app.ticker.stop()
        except Exception:
            pass
        self.input.teardown()


