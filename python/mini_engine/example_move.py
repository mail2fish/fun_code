"""
示例：使用 MiniEngine 实现一个可用方向键/WASD 移动的小方块。

步骤：
1. 网页准备好 id="gfx-root" 的 div，并加载 PIXI 与 Pyodide。
2. 运行本脚本，方块即可在画布内移动。
"""

from mini_engine import Game, Scene, RectNode, TextNode


class MoveScene(Scene):
    def on_start(self):
        # 玩家小方块
        self.player = RectNode(300, 220, 40, 40, 0x22c55e)
        self.add(self.player)

        # 提示文本
        self.tip = TextNode(10, 10, "方向键/WASD 移动，Space 改变颜色", 0xffffff, 16)
        self.add(self.tip)

        self.speed = 200  # 像素/秒

    def on_update(self, dt):
        g = self.game
        dx = (g.input.axis_right() - g.input.axis_left()) * self.speed * dt
        dy = (g.input.axis_down() - g.input.axis_up()) * self.speed * dt

        self.player.x = max(0, min(g.width - self.player.width, self.player.x + dx))
        self.player.y = max(0, min(g.height - self.player.height, self.player.y + dy))

        if g.input.was_pressed("Space"):
            # 随机一点颜色
            import math
            import random
            hue = random.random()
            color = int((math.sin(hue*6.283)+1)*0.5*0xffffff) & 0xffffff
            # 重新绘制矩形
            try:
                self.player._display.clear()
                self.player._display.beginFill(color)
                self.player._display.drawRect(0, 0, self.player.width, self.player.height)
                self.player._display.endFill()
            except Exception:
                pass


def main():
    game = Game(width=640, height=480)
    game.start(MoveScene())


main()


