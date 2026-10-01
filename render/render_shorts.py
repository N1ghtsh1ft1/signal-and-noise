import sys, pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent, os, subprocess, shutil
from playwright.sync_api import sync_playwright
only=sys.argv[1:] or ['holdings','slime-path','baseline','containment','packet-walk']
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1080,"height":1920})
    pg.on("pageerror", lambda e: print("ERR:",e))
    for k in only:
        d=f"{ROOT}/.frames/{k}"; shutil.rmtree(d,ignore_errors=True); os.makedirs(d)
        pg.goto(f"file://{ROOT}/render/short.html?p={k}&seed=42")
        pg.wait_for_function("window.ready"); n=pg.evaluate("TOTAL")
        for i in range(n):
            pg.evaluate(f"frame({i})")
            pg.screenshot(path=f"{d}/{i:04d}.jpg", type="jpeg", quality=88)
        # hold last frame 1s
        out=f"{ROOT}/media/{k}-short.mp4"
        subprocess.run(["ffmpeg","-y","-loglevel","error","-framerate","30","-i",f"{d}/%04d.jpg","-vf","tpad=stop_mode=clone:stop_duration=1.5","-c:v","libx264","-preset","slow","-crf","27","-pix_fmt","yuv420p","-movflags","+faststart",out],check=True)
        print(k, n, os.path.getsize(out)//1024, "KB")
    b.close()
