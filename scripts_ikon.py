# Ikon ApaKabaR: huruf "A" (lengkung + palang) di dalam gelembung chat. Gambar asli.
from PIL import Image, ImageDraw, ImageChops
S, N = 4, 1024
HIJAU = (6, 78, 70, 255)
EMAS_A = (253, 224, 122)
EMAS_B = (201, 151, 28)

def kanvas():
    return Image.new('L', (N * S, N * S), 0)

def sk(v, skala):  # skala terhadap pusat
    return 512 + (v - 512) * skala

def bentuk_a(skala):
    """Mask huruf A: lengkung berkaki lurus, lubang dalam, dan palang."""
    k = lambda v: sk(v, skala) * S
    m = kanvas(); d = ImageDraw.Draw(m)
    # luar: kaki + setengah elips atas
    d.rectangle((k(362), k(400), k(662), k(700)), fill=255)
    d.ellipse((k(362), k(250), k(662), k(550)), fill=255)
    # lubang dalam
    h = kanvas(); dh = ImageDraw.Draw(h)
    dh.rectangle((k(462), k(470), k(562), k(720)), fill=255)
    dh.ellipse((k(462), k(370), k(562), k(570)), fill=255)
    m = ImageChops.subtract(m, h)
    # palang
    d = ImageDraw.Draw(m)
    d.rectangle((k(362), k(545), k(662), k(605)), fill=255)
    return m

def bentuk_gelembung(skala):
    k = lambda v: sk(v, skala) * S
    m = kanvas(); d = ImageDraw.Draw(m)
    d.rounded_rectangle((k(182), k(182), k(842), k(782)), radius=190 * skala * S, fill=255)
    d.polygon([(k(250), k(720)), (k(215), k(885)), (k(400), k(775))], fill=255)
    return m

def ke_rgba(mask, warna):
    mask = mask.resize((N, N), Image.LANCZOS)
    im = Image.new('RGBA', (N, N), warna)
    im.putalpha(mask)
    return im

def gradien(a=(7, 94, 84), b=(37, 211, 102)):
    g = Image.new('RGBA', (N, N)); px = g.load()
    for y in range(N):
        for x in range(N):
            t = (x + y) / (2 * N)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
    return g

def logo(skala, warna_gelembung, warna_a):
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    if warna_gelembung == 'emas':
        g = gradien(EMAS_A, EMAS_B)
        g.putalpha(bentuk_gelembung(skala).resize((N, N), Image.LANCZOS))
        im.alpha_composite(g)
    else:
        im.alpha_composite(ke_rgba(bentuk_gelembung(skala), warna_gelembung))
    im.alpha_composite(ke_rgba(bentuk_a(skala), warna_a))
    return im

o = 'assets/'
bg = gradien((4, 52, 47), (10, 110, 92))
ikon = bg.copy(); ikon.alpha_composite(logo(1.0, 'emas', HIJAU))
ikon.convert('RGB').save(o + 'icon.png')
bg.save(o + 'android-icon-background.png')
logo(0.72, 'emas', HIJAU).save(o + 'android-icon-foreground.png')
# monokrom: gelembung terisi hitam, huruf A dilubangi
mono = Image.new('RGBA', (N, N), (0, 0, 0, 0))
g = ke_rgba(bentuk_gelembung(0.72), (0, 0, 0, 255))
a = bentuk_a(0.72).resize((N, N), Image.LANCZOS)
alpha = ImageChops.subtract(g.getchannel('A'), a)
mono = Image.new('RGBA', (N, N), (0, 0, 0, 255)); mono.putalpha(alpha)
mono.save(o + 'android-icon-monochrome.png')
logo(0.9, 'emas', HIJAU).save(o + 'splash-icon.png')
ikon.convert('RGB').resize((196, 196), Image.LANCZOS).save(o + 'favicon.png')
print('selesai')
