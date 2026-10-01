import pathlib
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parent.parent
out=ROOT/"media"/"carousel-control-placement"; out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1080,"height":1350})
    pg.on("pageerror", lambda e: print("ERR:",e))
    pg.goto(f"file://{ROOT}/render/carousel.html?s=1"); pg.wait_for_function("window.done"); n=pg.evaluate("TOTAL")
    files=[]
    for i in range(1,n+1):
        pg.goto(f"file://{ROOT}/render/carousel.html?s={i}"); pg.wait_for_function("window.done")
        h=pg.evaluate("document.querySelector('.wrap').scrollHeight")
        f=out/f"slide-{i:02d}.png"; pg.screenshot(path=str(f)); files.append(f); print(i,"content h",h)
    b.close()

import img2pdf; (ROOT/"media"/"control-placement-carousel.pdf").write_bytes(img2pdf.convert([str(f) for f in files]))
print("pdf ok")
