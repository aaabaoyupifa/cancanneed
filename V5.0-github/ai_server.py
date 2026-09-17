"""
命运之书 v4.2 — Flask AI 代理服务
- 提供静态文件服务（HTML/JS）
- 透明代理 DeepSeek API（非流式 + 流式）
- 配置管理（/api/config/save, /api/config/test）
"""
import json, os, sys, time, uuid, threading, re, hashlib, urllib.parse
from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from werkzeug.utils import secure_filename
from pathlib import Path

# ── 路径（兼容 PyInstaller onedir + 源码开发）──
if getattr(sys, 'frozen', False):
    APP_DIR = Path(sys._MEIPASS)
    EXE_DIR = Path(sys.executable).parent
else:
    APP_DIR = Path(__file__).parent
    EXE_DIR = APP_DIR

# ── 日志 ──
import logging
LOG_DIR = EXE_DIR / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='[AI-Server] %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'server.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# ── 配置 ──
CONFIG_PATH = EXE_DIR / 'config.json'
API_KEY = ''
API_URL = 'https://api.deepseek.com/v1/chat/completions'
API_MODEL = 'deepseek-chat'

def load_config():
    global API_KEY, API_URL, API_MODEL
    if CONFIG_PATH.exists():
        try:
            cfg = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
            API_KEY = cfg.get('api_key', '')
            API_URL = cfg.get('api_url', 'https://api.deepseek.com/v1/chat/completions')
            API_MODEL = cfg.get('api_model', 'deepseek-chat')
            logging.info(f'Config loaded: {API_MODEL}' if API_KEY else 'No API key found')
        except Exception as e:
            logging.warning(f'Failed to load config.json: {e}')

def save_config():
    try:
        CONFIG_PATH.write_text(json.dumps({
            'api_key': API_KEY, 'api_url': API_URL, 'api_model': API_MODEL
        }, ensure_ascii=False, indent=2), encoding='utf-8')
    except Exception as e:
        logging.warning(f'Failed to save config.json: {e}')

load_config()

app = Flask(__name__)
# MAX_CONTENT_LENGTH 不设限制——前端 _pruneForSave 已做修剪，且大存档不应阻止保存
# ── CORS + 安全头 ──
@app.after_request
def add_headers(response):
    origin = request.headers.get('Origin', '')
    if origin.startswith('http://127.0.0.1') or origin.startswith('http://localhost'):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response

# ═══════════════════════════════════════════
# 静态文件
# ═══════════════════════════════════════════

@app.route('/')
def index():
    html = (APP_DIR / 'interactive-fiction.html').read_text(encoding='utf-8')
    return html, 200, {'Content-Type': 'text/html; charset=utf-8'}

@app.route('/<path:filename>')
def serve_static(filename):
    # 只提供前端静态资源，不暴露 config.json / saves / logs 等本地数据。
    safe = filename.replace('\\', '/')
    allowed_root_files = {'interactive-fiction.html', 'world-builder.html', 'manifest.json'}
    if safe in allowed_root_files or (safe.startswith('js/') and safe.endswith('.js')):
        file_path = APP_DIR / safe
        if file_path.exists() and file_path.is_file():
            directory = str(file_path.parent)
            return send_from_directory(directory, file_path.name)
    return '', 404

@app.route('/icons/<path:filename>')
def serve_icon(filename):
    safe_name = secure_filename(filename)
    if safe_name not in {'icon-192.png', 'icon-512.png'}:
        return '', 404
    return send_from_directory(str(APP_DIR / 'icons'), safe_name)

@app.route('/debug')
def debug_page():
    """诊断页面：测试前端 JS 和 API 是否正常"""
    return '''<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><title>诊断</title>
<style>
body{font-family:monospace;max-width:700px;margin:40px auto;background:#0d0d0d;color:#ccc;padding:20px}
h1{color:#c9a84c}.pass{color:#4caf50}.fail{color:#e74c3c}.info{color:#aaa}
pre{background:#1a1a1a;padding:10px;border-radius:4px;overflow-x:auto;font-size:12px}
button{padding:10px 20px;margin:5px;border:1px solid #c9a84c;background:#1a1a1a;color:#c9a84c;cursor:pointer;border-radius:4px}
button:hover{background:#2a2a1a}
#log div{margin:4px 0;padding:4px 8px;border-left:3px solid #333}
#log .ok{border-left-color:#4caf50}#log .err{border-left-color:#e74c3c}
</style></head>
<body>
<h1>命运之书 v4.2 — 诊断</h1>
<div id="log"><div class="info">页面加载完成，开始检查...</div></div>
<button onclick="runDiag()">运行诊断</button>
<button onclick="testApiDirect()">直接测试 API</button>
<button onclick="testSave()">模拟保存流程</button>

<script>
function log(msg,t){const d=document.getElementById('log');const e=document.createElement('div');e.className=t||'info';e.textContent=new Date().toLocaleTimeString()+': '+msg;d.appendChild(e)}

async function runDiag(){
  log('=== 开始诊断 ===');
  log('1. 检查 URL: '+location.href);

  // 检查AI Bridge
  log('2. 检查 AIBridge...');
  if(typeof AIBridge!=='undefined'){
    log('   AIBridge: OK (type='+typeof AIBridge+')','ok');
    log('   _apiUrl = '+AIBridge._apiUrl,'info');
    log('   _apiKey = '+(AIBridge._apiKey?'已配置':'未配置'),'info');
    log('   _apiModel = '+AIBridge._apiModel,'info');
  }else{
    log('   AIBridge: FAIL - undefined!','err');
  }

  // 检查APIConfig
  log('3. 检查 APIConfig...');
  if(typeof APIConfig!=='undefined'){
    log('   APIConfig: OK','ok');
    if(typeof APIConfig.save==='function')log('   APIConfig.save: OK (函数存在)','ok');
    else log('   APIConfig.save: FAIL - 不是函数','err');
  }else{
    log('   APIConfig: FAIL - undefined!','err');
  }

  // 检查DOM元素
  log('4. 检查 DOM 元素...');
  ['api-url','api-key','api-model','api-config-error','api-config-card','api-config-overlay'].forEach(id=>{
    const el=document.getElementById(id);
    log('   #'+id+': '+(el?'存在 (display:'+(el.style.display||'')+')':'不存在'),el?'ok':'err');
  });

  // 测试 fetch
  log('5. 测试 fetch /api/config/test...');
  try{
    const r=await fetch('/api/config/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:'test',api_url:'https://api.deepseek.com/v1/chat/completions',api_model:'deepseek-chat'}),signal:AbortSignal.timeout(5000)});
    const d=await r.json();
    log('   fetch 完成: '+r.status+' '+JSON.stringify(d).slice(0,200),(r.status>=200&&r.status<500?'ok':'err'));
  }catch(e){
    log('   fetch 失败: '+e.message,'err');
  }
  log('=== 诊断完成 ===');
}

async function testApiDirect(){
  log('直接测试 API /api/config/test...');
  try{
    const r=await fetch('/api/config/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:'test-direct',api_url:'https://api.deepseek.com/v1/chat/completions',api_model:'deepseek-chat'}),signal:AbortSignal.timeout(10000)});
    log('Status: '+r.status);
    const d=await r.json();log('Response: '+JSON.stringify(d));
  }catch(e){log('Error: '+e.message,'err')}
}

async function testSave(){
  log('模拟 APIConfig.save()...');
  const keyEl=document.getElementById('api-key');
  const urlEl=document.getElementById('api-url');
  const modelEl=document.getElementById('api-model');
  if(!keyEl||!urlEl||!modelEl){log('DOM 元素不存在!','err');return}

  // 填充测试数据
  keyEl.value='test-save-key';
  urlEl.value='https://api.deepseek.com/v1/chat/completions';
  modelEl.value='deepseek-chat';

  // 检查APIConfig
  if(typeof APIConfig==='undefined'||typeof APIConfig.save!=='function'){log('APIConfig.save 不存在!','err');return}

  log('调用 APIConfig.save()...');
  try{
    await APIConfig.save();
    log('APIConfig.save() 完成');
  }catch(e){
    log('APIConfig.save() 抛出异常: '+e.message+'\\n'+e.stack,'err');
  }
}
</script>
</body></html>''', 200, {'Content-Type': 'text/html; charset=utf-8'}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'ok': True, 'configured': bool(API_KEY), 'model': API_MODEL})

@app.route('/portraits/<path:filename>')
def serve_portrait(filename):
    """提供生成的人物画像"""
    safe_name = secure_filename(filename)
    if not re.fullmatch(r'[a-f0-9]{12}\.png', safe_name):
        return '', 404
    return send_from_directory(str(PORTRAITS_DIR), safe_name)

# ═══════════════════════════════════════════
# API 透明代理
# ═══════════════════════════════════════════

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def api_chat():
    """OpenAI-compatible API transparent proxy using the user-selected upstream URL and model."""
    if request.method == 'OPTIONS':
        return '', 200

    if not API_KEY:
        return jsonify({'error': 'API未配置，请在设置中填入API Key'}), 400

    import requests as req
    try:
        data = request.get_json(force=True)
        # 服务端保存的模型是唯一来源，避免子模块残留的默认模型覆盖用户选择。
        data['model'] = API_MODEL
        is_stream = data.get('stream', False)

        headers = {
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json',
        }

        if is_stream:
            # 流式代理：透传 SSE
            def generate():
                try:
                    r = req.post(API_URL, headers=headers, json=data, stream=True, timeout=300)
                    if r.status_code != 200:
                        error_msg = json.dumps({'error': f'API {r.status_code}: {r.text[:200]}'})
                        yield f'data: {error_msg}\n\n'
                        return
                    for line in r.iter_lines():
                        if line:
                            yield line + b'\n'
                except Exception as e:
                    yield f'data: {{"error":"{str(e)[:200]}"}}\n\n'

            return Response(
                stream_with_context(generate()),
                mimetype='text/event-stream',
                headers={'X-Accel-Buffering': 'no'}
            )
        else:
            # 非流式代理
            r = req.post(API_URL, headers=headers, json=data, timeout=180)
            return jsonify(r.json()), r.status_code

    except req.exceptions.Timeout:
        return jsonify({'error': 'API请求超时'}), 504
    except req.exceptions.ConnectionError:
        return jsonify({'error': '无法连接到API服务器'}), 502
    except Exception as e:
        logging.error(f'API proxy error: {e}')
        return jsonify({'error': str(e)[:200]}), 500

# ═══════════════════════════════════════════
# 前端日志收集
# ═══════════════════════════════════════════

FRONTEND_LOG = LOG_DIR / 'frontend.log'

@app.route('/api/log', methods=['POST', 'OPTIONS'])
def frontend_log():
    """接收前端错误日志并写入文件"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(force=True)
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        level = data.get('level', 'error')
        msg = data.get('message', '')
        source = data.get('source', '')
        lineno = data.get('lineno', '')
        stack = data.get('stack', '')
        entry = f'[{timestamp}] [{level}] {msg}'
        if source:
            entry += f'  @ {source}:{lineno}'
        if stack:
            entry += f'\n  Stack: {stack}'
        entry += '\n'
        with FRONTEND_LOG.open('a', encoding='utf-8') as f:
            f.write(entry)
        # 超过 500KB 则截断保留最近部分
        size = FRONTEND_LOG.stat().st_size
        if size > 500 * 1024:
            lines = FRONTEND_LOG.read_text(encoding='utf-8').splitlines()
            FRONTEND_LOG.write_text('\n'.join(lines[-2000:]) + '\n', encoding='utf-8')
        logging.info(f'[Frontend-Log] {level}: {msg[:100]}')
    except Exception as e:
        logging.warning(f'Failed to write frontend log: {e}')
    return jsonify({'ok': True})

@app.route('/api/logs', methods=['GET'])
def frontend_logs_view():
    """查看前端日志（返回最近200行）"""
    if FRONTEND_LOG.exists():
        lines = FRONTEND_LOG.read_text(encoding='utf-8').splitlines()
        recent = lines[-200:]
        return '\n'.join(recent), 200, {'Content-Type': 'text/plain; charset=utf-8'}
    return '暂无日志', 200, {'Content-Type': 'text/plain; charset=utf-8'}

# ═══════════════════════════════════════════
# 配置管理
# ═══════════════════════════════════════════

@app.route('/api/config', methods=['GET'])
def config_get():
    """返回当前 API 配置（供前端自动读取）"""
    return jsonify({
        'ok': True,
        'api_key': API_KEY,
        'api_url': API_URL,
        'api_model': API_MODEL,
    })

@app.route('/api/config/save', methods=['POST', 'OPTIONS'])
def config_save():
    if request.method == 'OPTIONS':
        return '', 200
    global API_KEY, API_URL, API_MODEL
    data = request.get_json(force=True)
    API_KEY = data.get('api_key', '').strip()
    API_URL = data.get('api_url', 'https://api.deepseek.com/v1/chat/completions').strip() or 'https://api.deepseek.com/v1/chat/completions'
    API_MODEL = data.get('api_model', 'deepseek-chat').strip() or 'deepseek-chat'
    save_config()
    logging.info(f'Config saved: {API_MODEL}')
    return jsonify({'ok': True})

@app.route('/api/config/test', methods=['POST', 'OPTIONS'])
def config_test():
    """测试 API 连接（独立 key 测试，不覆盖已保存配置）"""
    if request.method == 'OPTIONS':
        return '', 200
    import requests as req
    data = request.get_json(force=True)
    test_key = data.get('api_key', '').strip()
    test_url = data.get('api_url', 'https://api.deepseek.com/v1/chat/completions').strip() or 'https://api.deepseek.com/v1/chat/completions'
    test_model = data.get('api_model', 'deepseek-chat').strip() or 'deepseek-chat'

    if not test_key:
        return jsonify({'ok': False, 'error': 'API Key 不能为空'})

    try:
        r = req.post(test_url,
            headers={'Authorization': f'Bearer {test_key}', 'Content-Type': 'application/json'},
            json={
                'model': test_model,
                'messages': [{'role': 'user', 'content': '1+1=?'}],
                'max_tokens': 5,
                'temperature': 0,
            },
            timeout=15)
        if r.status_code == 200:
            data_resp = r.json()
            if data_resp.get('choices'):
                return jsonify({'ok': True, 'model': test_model, 'verified': True})
            return jsonify({'ok': False, 'error': f'API返回异常: {str(data_resp)[:200]}'})
        elif r.status_code == 401:
            return jsonify({'ok': False, 'error': 'API Key 无效（401 未授权）'})
        elif r.status_code == 404:
            return jsonify({'ok': False, 'error': f'模型 "{test_model}" 不存在（404）'})
        else:
            return jsonify({'ok': False, 'error': f'API 返回错误 {r.status_code}: {r.text[:200]}'})
    except req.exceptions.Timeout:
        return jsonify({'ok': False, 'error': '连接超时（15秒）'})
    except req.exceptions.ConnectionError:
        return jsonify({'ok': False, 'error': '无法连接到 API 地址'})
    except Exception as e:
        return jsonify({'ok': False, 'error': f'连接失败: {str(e)[:200]}'})


# ═══════════════════════════════════════════
# 存档管理（服务端文件存储）
# ═══════════════════════════════════════════

SAVES_DIR = EXE_DIR / 'saves'
SAVES_DIR.mkdir(parents=True, exist_ok=True)

PORTRAITS_DIR = EXE_DIR / 'portraits'
PORTRAITS_DIR.mkdir(parents=True, exist_ok=True)

def _safe_slot(value):
    try:
        slot = int(value)
    except (TypeError, ValueError):
        return None
    return slot if 0 <= slot <= 4 else None

@app.route('/api/save', methods=['GET', 'POST', 'DELETE'])
def save_api():
    """存档 CRUD：GET=读取, POST=保存, DELETE=删除"""
    # GET 读取存档
    if request.method == 'GET':
        slot = _safe_slot(request.args.get('slot'))
        if slot is None:
            return jsonify({'ok': False, 'error': 'slot 必须是 0-4'}), 400
        fpath = SAVES_DIR / f'slot_{slot}.json'
        if not fpath.exists():
            return jsonify({'ok': False, 'error': 'not_found'}), 404
        try:
            data = json.loads(fpath.read_text(encoding='utf-8'))
            return jsonify({'ok': True, 'data': data})
        except Exception as e:
            return jsonify({'ok': False, 'error': str(e)}), 500

    # POST 保存/写入
    if request.method == 'POST':
        try:
            body = request.get_json(force=True)
            slot = _safe_slot(body.get('slot', 0))
            if slot is None:
                return jsonify({'ok': False, 'error': 'slot 必须是 0-4'}), 400
            data = body.get('data', {})
            fpath = SAVES_DIR / f'slot_{slot}.json'
            fpath.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
            logging.info(f'[Save] Slot {slot} saved')
            return jsonify({'ok': True})
        except Exception as e:
            logging.error(f'[Save] Error: {e}')
            return jsonify({'ok': False, 'error': str(e)}), 500

    # DELETE 删除
    if request.method == 'DELETE':
        slot = _safe_slot(request.args.get('slot'))
        if slot is None:
            return jsonify({'ok': False, 'error': 'slot 必须是 0-4'}), 400
        fpath = SAVES_DIR / f'slot_{slot}.json'
        if fpath.exists():
            fpath.unlink()
            logging.info(f'[Save] Slot {slot} deleted')
        return jsonify({'ok': True})

@app.route('/api/saves', methods=['GET'])
def saves_list():
    """返回所有存档的meta列表"""
    saves = []
    for i in range(5):  # 支持0-4共5个槽位
        fpath = SAVES_DIR / f'slot_{i}.json'
        if fpath.exists():
            try:
                data = json.loads(fpath.read_text(encoding='utf-8'))
                meta = data.get('meta', {})
                saves.append({
                    'slot': i,
                    'meta': meta,
                    'time': data.get('time', ''),
                })
            except Exception as e:
                logging.warning(f'[Saves] Failed to read slot_{i}: {e}')
    return jsonify({'ok': True, 'saves': saves})

# ═══════════════════════════════════════════
# AI 人物画像生成（动漫画风）
# ═══════════════════════════════════════════

def _build_anime_prompt(data):
    """根据人物数据构建英文动漫风格生图提示词"""
    name = data.get('name', '')
    role = data.get('role', '')
    appearance = data.get('appearance', '')
    personality = data.get('personality', '')
    bg = data.get('bg', '')
    genre = data.get('genre', '')
    worldName = data.get('worldName', '')

    # 角色类型映射
    role_style = {
        'protagonist': 'heroic and charismatic',
        'ally': 'friendly and reliable',
        'antagonist': 'menacing and powerful',
        'neutral': 'mysterious and calm',
    }.get(role, 'distinctive')

    # 性别判断
    is_female = False
    all_text = f'{name} {appearance} {personality} {bg}'
    female_keywords = ['女', '娘', '姐', '妹', '姬', '仙子', '夫人', '妃', 'female', 'woman', 'girl']
    male_keywords = ['男', '君', '王', '帝', '公子', '侠', 'male', 'man', 'boy']
    if any(k in all_text for k in female_keywords):
        is_female = True

    gender_word = 'female' if is_female else 'male'

    # 体裁风格
    genre_style = ''
    if '修仙' in genre or '仙侠' in genre:
        genre_style = 'xianxia cultivation style, flowing traditional Chinese robes, ethereal atmosphere'
    elif '武侠' in genre:
        genre_style = 'wuxia martial arts style, traditional Chinese warrior outfit'
    elif '玄幻' in genre:
        genre_style = 'fantasy style, elaborate fantasy costume'
    elif '都市' in genre or '现代' in genre:
        genre_style = 'modern casual outfit, contemporary setting'
    elif '科幻' in genre:
        genre_style = 'sci-fi style, futuristic outfit'
    elif '古风' in genre or '古代' in genre:
        genre_style = 'ancient Chinese hanfu robes, classical elegance'
    else:
        genre_style = 'fantasy adventure style'

    # 外观整合（取关键描述，限制长度）
    desc = (appearance or '').strip()
    if len(desc) > 150:
        desc = desc[:150]

    prompt = (
        f'anime style character portrait, {gender_word}, {role_style}, '
        f'{genre_style}, '
        f'{desc}, '
        f'upper body, looking at viewer, '
        f'clean lineart, vibrant colors, soft shading, '
        f'high quality anime illustration, detailed face, beautiful lighting, '
        f'white background'
    )
    # 确保不超过 ~600 字符
    if len(prompt) > 600:
        prompt = prompt[:597] + '...'

    return prompt


@app.route('/api/generate-portrait', methods=['POST', 'OPTIONS'])
def generate_portrait():
    """AI 生成人物动漫画像：构建 prompt → 调生图 API → 保存本地 → 返回 URL"""
    if request.method == 'OPTIONS':
        return '', 200

    import requests as req
    data = request.get_json(force=True)
    name = data.get('name', 'unknown').strip()
    if not name:
        return jsonify({'ok': False, 'error': '缺少人物姓名'}), 400

    # 生成唯一文件名
    prompt_raw = _build_anime_prompt(data)
    img_hash = hashlib.md5((name + prompt_raw[:100]).encode()).hexdigest()[:12]
    img_path = PORTRAITS_DIR / f'{img_hash}.png'
    img_url = f'/portraits/{img_hash}.png'

    # 已有缓存直接返回
    if img_path.exists():
        logging.info(f'[Portrait] Cache hit for {name}')
        return jsonify({'ok': True, 'url': img_url, 'cached': True})

    logging.info(f'[Portrait] Generating for {name}...')

    def try_generate(prompt, timeout=90):
        """尝试用 Pollinations.ai 生成图片"""
        encoded = urllib.parse.quote(prompt)
        seed = int(hashlib.md5((name + prompt[:80]).encode('utf-8')).hexdigest()[:8], 16) % 100000
        api_url = f'https://image.pollinations.ai/prompt/{encoded}?width=512&height=768&nologo=true&seed={seed}'
        r = req.get(api_url, timeout=timeout)
        if r.status_code == 200 and len(r.content) > 1000:
            img_path.write_bytes(r.content)
            return True
        return False

    # 主尝试：用完整 prompt
    try:
        if try_generate(prompt_raw):
            logging.info(f'[Portrait] Generated: {img_url}')
            return jsonify({'ok': True, 'url': img_url})
    except Exception as e:
        logging.warning(f'[Portrait] Primary attempt failed: {e}')

    # 回退：精简 prompt
    simplified = (
        f'anime character portrait, {data.get("appearance", "")[:80]}, '
        f'{data.get("genre", "")}, '
        f'clean anime art style, upper body, white background'
    )
    try:
        if try_generate(simplified, 90):
            logging.info(f'[Portrait] Fallback generated: {img_url}')
            return jsonify({'ok': True, 'url': img_url})
    except Exception as e:
        logging.warning(f'[Portrait] Fallback failed: {e}')

    return jsonify({'ok': False, 'error': '画像生成失败，请稍后重试'}), 500


# ═══════════════════════════════════════════
# 主入口（直接运行 + 被 launcher.py 导入）
# ═══════════════════════════════════════════

if __name__ == '__main__':
    import webbrowser, webview
    print(f'[AI-Server] Starting on http://localhost:8765', flush=True)

    # 启动 Flask 在后台线程
    def run_flask():
        app.run(host='127.0.0.1', port=8765, debug=False, threaded=True)

    threading.Thread(target=run_flask, daemon=True).start()
    time.sleep(1.5)

    # 打开窗口
    try:
        webview.create_window('命运之书', 'http://localhost:8765', width=1280, height=820, resizable=True, min_size=(900, 600))
        webview.start()
    except Exception as e:
        print(f'[AI-Server] Window error: {e}', flush=True)
        webbrowser.open('http://localhost:8765')
        try:
            while True: time.sleep(60)
        except KeyboardInterrupt:
            pass

