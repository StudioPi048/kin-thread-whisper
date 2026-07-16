def relative_luminance(r, g, b):
    # sRGB colorspace calculation
    def adjust(color):
        c = color / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b)

def contrast_ratio(l1, l2):
    bright = max(l1, l2)
    dark = min(l1, l2)
    return (bright + 0.05) / (dark + 0.05)

def hex_to_rgb(hex_code):
    hex_code = hex_code.lstrip('#')
    if len(hex_code) == 3:
        hex_code = "".join([c*2 for c in hex_code])
    return tuple(int(hex_code[i:i+2], 16) for i in (0, 2, 4))

def blend_rgba(bg_r, bg_g, bg_b, fg_r, fg_g, fg_b, alpha):
    r = fg_r * alpha + bg_r * (1 - alpha)
    g = fg_g * alpha + bg_g * (1 - alpha)
    b = fg_b * alpha + bg_b * (1 - alpha)
    return (r, g, b)

tests = [
    # Header Hover
    ("Header 'Entrar' Hover", hex_to_rgb("#FCF9F4"), hex_to_rgb("#D4AF37")),
    # Pilares number
    ("Pilares label", hex_to_rgb("#1C201B"), blend_rgba(28, 32, 27, 255, 255, 255, 0.4)),
    # Seção Gestão Impecável
    ("Gestão Subtítulo", hex_to_rgb("#F5F0E8"), hex_to_rgb("#8B7355")),
    ("Gestão Ênfase/Ícone", hex_to_rgb("#F5F0E8"), hex_to_rgb("#C8A640")),
    ("Quote Autor", hex_to_rgb("#FCF9F4"), blend_rgba(252, 249, 244, 59, 47, 31, 0.5)),
    ("Footer Sub-rodapé", hex_to_rgb("#1B211A"), blend_rgba(27, 33, 26, 255, 255, 255, 0.35)),
    # Baseline checks
    ("Hero Body", hex_to_rgb("#1B211A"), blend_rgba(27, 33, 26, 255, 255, 255, 0.75)),
]

for name, bg, fg in tests:
    l_bg = relative_luminance(*bg)
    l_fg = relative_luminance(*fg)
    cr = contrast_ratio(l_bg, l_fg)
    print(f"{name}: {cr:.2f}:1")
