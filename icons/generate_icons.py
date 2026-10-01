# -*- coding: utf-8 -*-
"""
生成人情往来簿 PWA 手机图标
风格：深棕底 + 宣纸账本 + 红色礼印（与 App 暖纸风一致）
输出：
  icon-192.png / icon-512.png       安卓常规图标
  icon-maskable-192/512.png         安卓自适应图标（内容收进安全区）
  apple-touch-icon.png (180x180)    苹果主屏幕图标
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))

BROWN = (43, 33, 23)        # #2b2117
BROWN2 = (62, 48, 33)       # 渐变亮部
PAPER = (251, 244, 226)     # #fbf4e2
PAPER_EDGE = (229, 213, 184)
SEAL = (168, 50, 46)        # #a8322e
WHITE = (255, 255, 255)


def load_font(size):
    candidates = [
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\simsun.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def vgrad(size, top, bottom):
    """竖向渐变底图"""
    img = Image.new("RGB", (size, size), top)
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def draw_book(size, scale=1.0):
    """
    绘制主体：一张宣纸账本卡片 + 红色礼印 + 礼字
    scale: 内容整体缩放（maskable 用更小的 scale）
    返回 RGBA 图层
    """
    S = size
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # 账本卡片矩形（居中）
    cw = int(S * 0.60 * scale)
    ch = int(S * 0.66 * scale)
    x0 = (S - cw) // 2
    y0 = (S - ch) // 2 + int(S * 0.02 * scale)
    x1 = x0 + cw
    y1 = y0 + ch
    radius = int(S * 0.05 * scale)

    # 卡片阴影
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    off = int(S * 0.018 * scale)
    sd.rounded_rectangle([x0, y0 + off, x1, y1 + off],
                         radius=radius, fill=(20, 12, 6, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.012))
    layer.alpha_composite(shadow)

    # 卡片纸页
    d.rounded_rectangle([x0, y0, x1, y1], radius=radius,
                        fill=PAPER + (255,), outline=PAPER_EDGE + (255,),
                        width=max(2, int(S * 0.006)))

    # 纸页上的账本行（装饰横线）
    pad = int(S * 0.075 * scale)
    line_h = int(S * 0.022 * scale)
    gap = int(S * 0.075 * scale)
    ly = y0 + int(S * 0.17 * scale)
    widths = [0.78, 0.62, 0.78, 0.55]
    for i, wf in enumerate(widths):
        w = int(cw * wf)
        d.rounded_rectangle([x0 + pad, ly, x0 + pad + w, ly + line_h],
                            radius=line_h // 2,
                            fill=(214, 200, 168, 255))
        ly += gap

    # 红色礼印（圆形，完整落在卡片右上角内）
    seal_margin = int(S * 0.05 * scale)
    seal_r = int(S * 0.135 * scale)
    cx = x1 - seal_margin - seal_r
    cy = y0 + seal_margin + seal_r
    d.ellipse([cx - seal_r, cy - seal_r, cx + seal_r, cy + seal_r],
              fill=SEAL + (255,))
    # 印圈高光边
    d.ellipse([cx - seal_r, cy - seal_r, cx + seal_r, cy + seal_r],
              outline=(255, 235, 220, 120),
              width=max(1, int(S * 0.005)))

    # 礼字
    fsize = int(seal_r * 1.18)
    font = load_font(fsize)
    txt = "\u793c"
    tb = d.textbbox((0, 0), txt, font=font)
    tw_, th_ = tb[2] - tb[0], tb[3] - tb[1]
    d.text((cx - tw_ / 2 - tb[0], cy - th_ / 2 - tb[1]),
           txt, font=font, fill=WHITE)

    return layer


def make_icon(size, maskable=False, rounded=False):
    # 底色（深棕竖向渐变）
    img = vgrad(size, BROWN, BROWN2).convert("RGBA")

    scale = 0.78 if maskable else 1.0
    body = draw_book(size, scale=scale)
    img.alpha_composite(body)

    if rounded:
        # 苹果旧版 iOS 会自动圆角；这里给全方图即可，
        # 但个别浏览器需要预圆角，提供轻微圆角更安全
        r = int(size * 0.0)
        if r:
            mask = rounded_mask(size, r)
            img.putalpha(mask)

    return img.convert("RGB")


def main():
    jobs = [
        ("icon-512.png", 512, False),
        ("icon-192.png", 192, False),
        ("icon-maskable-512.png", 512, True),
        ("icon-maskable-192.png", 192, True),
        ("apple-touch-icon.png", 180, False),
    ]
    for name, size, maskable in jobs:
        icon = make_icon(size, maskable=maskable)
        icon.save(os.path.join(HERE, name), "PNG")
        print("saved", name, size)


if __name__ == "__main__":
    main()
