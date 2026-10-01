import os, shutil, subprocess, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
d=ROOT/".frames"/"darpa"; shutil.rmtree(d,ignore_errors=True); d.mkdir(parents=True)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1080,"height":1920})
    pg.on("pageerror", lambda e: print("ERR:",e))
    pg.goto(f"file://{ROOT}/render/darpa_short.html"); pg.wait_for_function("window.ready"); n=pg.evaluate("TOTAL")
    for i in range(n):
        pg.evaluate(f"frame({i})"); pg.screenshot(path=str(d/f"{i:04d}.jpg"), type="jpeg", quality=88)
    b.close()
out=ROOT/"media"/"darpa-lineage-short.mp4"
subprocess.run(["ffmpeg","-y","-loglevel","error","-framerate","30","-i",str(d/"%04d.jpg"),"-c:v","libx264","-preset","slow","-crf","24","-pix_fmt","yuv420p","-movflags","+faststart",str(out)],check=True)
print(n, os.path.getsize(out)//1024,"KB")
