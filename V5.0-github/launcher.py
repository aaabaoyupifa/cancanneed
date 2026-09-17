"""
命运之书 v4.2 — 桌面启动器
- 启动 Flask AI 代理服务（端口 8765）
- pywebview 原生窗口
- 自动清理
"""
import threading, time, os, sys, socket, webview

# Flask app（ai_server.py 中定义）
from ai_server import app as flask_app

def find_free_port(start=8765, end=8795):
    """优先使用 8765；被占用时自动寻找下一个可用端口。"""
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    raise RuntimeError('没有可用的本地端口（8765-8795）')

SERVER_PORT = find_free_port()
SERVER_URL = f'http://127.0.0.1:{SERVER_PORT}'

# ── pywebview API 类（供 JS 调用） ──
class AppApi:
    def close_window(self):
        try: webview.windows[0].destroy()
        except: os._exit(0)

    # ── 存档方法（供 JS 通过 pywebview.api 调用）──
    def save_game(self, slot, data_json):
        import json
        from pathlib import Path
        try:
            saves_dir = Path(__file__).parent / 'saves'
            saves_dir.mkdir(parents=True, exist_ok=True)
            fpath = saves_dir / f'slot_{int(slot)}.json'
            data = json.loads(data_json) if isinstance(data_json, str) else data_json
            fpath.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
            return {'ok': True}
        except Exception as e:
            return {'ok': False, 'error': str(e)}

    def load_game(self, slot):
        import json
        from pathlib import Path
        try:
            fpath = Path(__file__).parent / 'saves' / f'slot_{int(slot)}.json'
            if not fpath.exists():
                return None
            data = json.loads(fpath.read_text(encoding='utf-8'))
            return data
        except Exception as e:
            return {'error': str(e)}

    def list_saves(self):
        import json
        from pathlib import Path
        try:
            saves_dir = Path(__file__).parent / 'saves'
            saves = []
            for i in range(5):
                fpath = saves_dir / f'slot_{i}.json'
                if fpath.exists():
                    data = json.loads(fpath.read_text(encoding='utf-8'))
                    saves.append({'slot': i, 'meta': data.get('meta', {}), 'time': data.get('time', '')})
            return {'ok': True, 'saves': saves}
        except Exception as e:
            return {'ok': True, 'saves': []}

    def delete_save(self, slot):
        from pathlib import Path
        try:
            fpath = Path(__file__).parent / 'saves' / f'slot_{int(slot)}.json'
            if fpath.exists():
                fpath.unlink()
            return {'ok': True}
        except Exception as e:
            return {'ok': False, 'error': str(e)}

# ── 启动 Flask ──
def start_flask():
    flask_app.run(host='127.0.0.1', port=SERVER_PORT, debug=False, threaded=True)

flask_thread = threading.Thread(target=start_flask, daemon=True)
flask_thread.start()

# ── 等待服务就绪 ──
import urllib.request
for _ in range(30):
    time.sleep(0.3)
    try:
        urllib.request.urlopen(f'{SERVER_URL}/health', timeout=1)
        print('[Launcher] Server ready.', flush=True)
        break
    except:
        pass
else:
    print('[Launcher] Server may have started, proceeding.', flush=True)

# ── 原生窗口 ──
try:
    print('[Launcher] Opening native window...', flush=True)
    webview.create_window(
        '命运之书',
        SERVER_URL,
        js_api=AppApi(),
        width=1280, height=820,
        resizable=True, min_size=(900, 600),
    )
    webview.start()
except ImportError:
    print('[Launcher] pywebview not installed, opening browser...', flush=True)
    import webbrowser
    webbrowser.open(SERVER_URL)
    try:
        while True: time.sleep(60)
    except KeyboardInterrupt:
        pass
except Exception as e:
    print(f'[Launcher] Window error: {e}', flush=True)
    import webbrowser
    webbrowser.open(SERVER_URL)
    try:
        while True: time.sleep(60)
    except KeyboardInterrupt:
        pass
