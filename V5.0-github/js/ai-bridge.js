// ============================
// AI BRIDGE — 通过 Flask 代理调用 DeepSeek API
// ============================
console.log('[ai-bridge] loading...');
var AIBridge = {
  // === 配置 ===
  _apiKey: '',
  _apiUrl: '/api/chat',  // 前端始终通过本地 Flask 代理
  _providerUrl: 'https://api.deepseek.com/v1/chat/completions', // 上游地址：可由用户修改
  _apiModel: 'deepseek-chat',

  // 安全创建超时信号（兼容 WebView2 等不支持 AbortSignal.timeout 的环境）
  _timeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
  },

  // === 速率限制 ===
  _rateLog: {},
  _checkRate(key) {
    const now = Date.now();
    const window = this._rateLog[key] || [];
    this._rateLog[key] = window.filter(t => now - t < 60000);
    if (this._rateLog[key].length >= 30) return false;
    this._rateLog[key].push(now);
    return true;
  },

  // === 初始化 ===
  init() {
    const saved = localStorage.getItem('if-api-config');
    if (saved) {
      try {
        const cfg = JSON.parse(saved);
        this._apiKey = cfg.api_key || '';
        this._providerUrl = cfg.api_url || 'https://api.deepseek.com/v1/chat/completions';
        this._apiModel = cfg.api_model || 'deepseek-chat';
        // 同步后端配置
        this._syncConfigToServer();
      } catch(e) {}
    }
    this._apiUrl = '/api/chat';
  },

  /** 将本地配置同步到 Flask 后端 */
  _syncConfigToServer() {
    // 用 XHR 替代 fetch（WebView2 里 fetch 可能挂起）
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/config/save', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({
      api_key: this._apiKey,
      api_url: this._providerUrl || 'https://api.deepseek.com/v1/chat/completions',
      api_model: this._apiModel,
    }));
  },

  isConfigured() { return !!this._apiKey; },

  setConfig(key, url, model) {
    this._apiKey = key;
    this._apiUrl = '/api/chat';  // 浏览器请求仍固定走本地代理
    this._providerUrl = (url || '').trim() || 'https://api.deepseek.com/v1/chat/completions';
    this._apiModel = (model || '').trim() || 'deepseek-chat';
    // 同步后端
    this._syncConfigToServer();
  },

  // === 核心：调用 DeepSeek API（非流式） ===
  async _callAPI(prompt, maxTokens, temperature, retries, timeoutMs) {
    retries = retries || 2;
    timeoutMs = timeoutMs || 60000;
    let lastError = null;
    for (let i = 0; i <= retries; i++) {
      try {
        const payload = {
          model: this._apiModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens || 600,
          temperature: temperature != null ? temperature : 0.9,
        };
        const text = await this._xhrPost('/api/chat', payload, timeoutMs);
        const data = JSON.parse(text);
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
          const content = data.choices[0].message.content;
          if (content.trim().length >= 2) return content.trim();
        }
        throw new Error('API returned empty response');
      } catch(e) {
        const msg = e.message || '';
        if (msg.includes('timeout') || msg.includes(' Timeout')) {
          if (i < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
          throw new Error('API请求超时（' + Math.round(timeoutMs/1000) + '秒），可能是 API 负载高或网络慢');
        }
        if (msg.includes('Failed to') || msg.includes('network') || msg.includes('Network')) {
          if (i < retries) { await new Promise(r => setTimeout(r, 3000)); continue; }
          throw new Error('无法连接到API服务器，请检查网络或 API 地址');
        }
        lastError = e;
        if (i >= retries) throw e;
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      }
    }
    throw lastError || new Error('API调用失败');
  },

  // XHR POST 封装（WebView2 兼容）
  _xhrPost(url, body, timeoutMs) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = timeoutMs || 60000;
      xhr.onload = function() {
        if (xhr.status === 200) resolve(xhr.responseText);
        else {
          let errMsg = 'API error ' + xhr.status;
          try { const d = JSON.parse(xhr.responseText); errMsg += ': ' + (d.error?.message || ''); } catch(e) {}
          reject(new Error(errMsg));
        }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.ontimeout = function() { reject(new Error('timeout')); };
      xhr.send(JSON.stringify(body));
    });
  },

  // XHR 流式封装
  _xhrStreamPost(url, body, onToken, signal) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.responseType = 'text';
      let buf = '';
      xhr.onprogress = function() {
        if (signal && signal.aborted) { xhr.abort(); return; }
        const newText = xhr.responseText.substring(buf.length);
        buf += newText;
        const lines = newText.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6);
          if (d === '[DONE]') continue;
          try {
            const j = JSON.parse(d);
            const t = j.choices?.[0]?.delta?.content || '';
            if (t && onToken) onToken(t);
          } catch(e) {}
        }
      };
      xhr.onload = function() {
        if (xhr.status === 200) resolve();
        else reject(new Error('Stream API error ' + xhr.status));
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      if (signal) signal.addEventListener('abort', () => xhr.abort());
      xhr.send(JSON.stringify(body));
    });
  },

  // === 核心：流式调用（XHR 替代 fetch） ===
  async *_callAPIStream(prompt, maxTokens, temperature, signal) {
    const payload = {
      model: this._apiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens || 4000,
      temperature: temperature != null ? temperature : 0.85,
      stream: true,
    };
    // 用 XHR 收流，通过回调收集 token，再逐条 yield
    const tokens = [];
    let done = false;
    let err = null;
    await this._xhrStreamPost('/api/chat', payload, (token) => {
      tokens.push(token);
    }, signal).then(() => { done = true; }).catch((e) => { err = e; done = true; });
    // yield 已收到的 token
    while (tokens.length > 0) {
      yield tokens.shift();
    }
    if (err) throw err;
  },

  // ═══════════════════════════════════════════
  // 以下移植自 ai_server.py
  // ═══════════════════════════════════════════

  // === 工具函数 ===
  _extractInt(text) {
    const m = String(text).match(/-?\d+/);
    return m ? parseInt(m[0]) : 0;
  },

  _safeJsonParse(content, label) {
    if (!content || !content.trim()) throw new Error('AI返回了空内容');
    let c = content.trim();

    // Step 1: 剥离 markdown 代码块
    if (c.startsWith('```json')) c = c.slice(7);
    else if (c.startsWith('```')) c = c.slice(3);
    if (c.endsWith('```')) c = c.slice(0, -3);
    c = c.trim().replace('\ufeff', '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Step 2: 提取 JSON 边界 { ... }
    const stripped = c.trim();
    if (stripped.startsWith('{') || stripped.startsWith('[')) {
      const opener = stripped[0];
      const closer = opener === '[' ? ']' : '}';
      const start = c.indexOf(opener);
      const end = c.lastIndexOf(closer);
      if (start >= 0 && end > start) c = c.slice(start, end + 1);
    }

    // Step 3: 标准解析
    try { return JSON.parse(c); } catch(e) { /* 继续修复流程 */ }

    // Step 4: 修复常见 AI 输出问题后重新解析
    let fixed = this._fixAiJson(c);
    try { return JSON.parse(fixed); } catch(e2) { /* 继续 */ }

    // Step 5: 用正则暴力提取字段（最终兜底）
    const extracted = this._extractFieldsFromText(content, label);
    if (extracted) return extracted;

    console.error('[' + (label || 'json') + '] JSON parse failed. Preview:', c.slice(0, 500));
    throw new Error('JSON 解析失败，原始内容前500字：' + c.slice(0, 300));
  },

  /** 修复 AI 返回的常见 JSON 格式问题 */
  _fixAiJson(s) {
    let r = s;
    // 移除单行注释和多行注释
    r = r.replace(/\/\/[^\n]*/g, '');
    r = r.replace(/\/\*[\s\S]*?\*\//g, '');
    // 尾逗号
    r = r.replace(/,\s*([}\]])/g, '$1');
    // 单引号 -> 双引号（简单替换，不处理内部嵌套引号）
    r = r.replace(/'/g, '"');
    // 无引号键名 -> 加引号
    r = r.replace(/([{,]\s*)([a-zA-Z_]\w*)(\s*:)/g, '$1"$2"$3');
    // 字符串值内的未转义换行 —— 在双引号字符串内将真实换行替换为 \n 转义
    r = this._fixNewlinesInStrings(r);
    return r;
  },

  /** 修复 JSON 字符串值中的未转义换行 */
  _fixNewlinesInStrings(s) {
    let result = '';
    let inStr = false;
    let escape = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escape) {
        result += ch;
        escape = false;
        continue;
      }
      if (ch === '\\') {
        result += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        result += ch;
        continue;
      }
      if (inStr && (ch === '\n')) {
        result += '\\n';
        continue;
      }
      if (inStr && (ch === '\t')) {
        result += '\\t';
        continue;
      }
      if (inStr && (ch === '\r')) {
        continue; // skip \r in strings
      }
      result += ch;
    }
    return result;
  },

  /** 最终兜底：用正则从非结构化文本中提取 JSON 字段 */
  _extractFieldsFromText(text, label) {
    const fields = ['world_name', 'genre', 'world_desc', 'era', 'locations', 'factions', 'power_system'];
    const obj = {};
    for (const f of fields) {
      // 匹配 "field": "value" 或 "field": "value with \"escapes\"" （跨行也支持）
      const idx = text.indexOf('"' + f + '"');
      if (idx === -1) {
        // 尝试无下划线匹配
        const altIdx = text.indexOf(f.replace(/_/g, ''));
        if (altIdx === -1) continue;
      }
      // 从字段名开始找冒号和值
      const searchFrom = idx >= 0 ? idx : text.indexOf(f.replace(/_/g, ''));
      if (searchFrom === -1) continue;

      const afterKey = text.substring(searchFrom);
      // 找到 ": 后面的第一个引号开始取值
      const valMatch = afterKey.match(/:\s*"((?:[^"\\]|\\.)*)"/s);
      if (valMatch) {
        try {
          obj[f] = JSON.parse('"' + valMatch[1] + '"');
        } catch(e) {
          obj[f] = valMatch[1].replace(/\\n/g, '\n');
        }
      }
    }
    // 提取 protagonist 对象
    const protMatch = text.match(/"protagonist"\s*:\s*\{([\s\S]*?)(?=\}\s*(?:,?\s*(?:")[^"]+"\s*:|\}\s*$))/);
    if (protMatch) {
      const protBody = protMatch[1];
      const prot = {};
      const protFields = ['name','age','sex','personality','oneLine','one_line','appearance','background','ability','goal'];
      for (const pf of protFields) {
        const pm = protBody.match(new RegExp('"\\s*' + pf + '\\s*"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"','s'));
        if (pm) {
          try { prot[pf] = JSON.parse('"' + pm[1] + '"'); }
          catch(e) { prot[pf] = pm[1]; }
        }
        // 也尝试数字 age
        const nm = protBody.match(new RegExp('"\\s*' + pf + '\\s*"\\s*:\\s*(\\d+)'));
        if (nm) prot[pf] = parseInt(nm[1]);
      }
      if (Object.keys(prot).length > 0) obj.protagonist = prot;
    }
    if (Object.keys(obj).length >= 2) return obj; // 至少有2个字段才算有效
    return null;
  },

  _inferChoiceType(text) {
    const s = String(text || '').toLowerCase();
    const has = (...words) => words.some(w => s.includes(w));
    if (has('\u6218', '\u6740', '\u6253', '\u65a9', '\u51b2\u950b', '\u5f3a\u653b', '\u786c\u95ef', 'combat')) return 'combat_risk';
    if (has('\u9003', '\u64a4', '\u8eb2', '\u907f\u5f00', '\u8131\u8eab', 'escape')) return 'escape';
    if (has('\u67e5', '\u8c03\u67e5', '\u7ebf\u7d22', '\u641c\u7d22', '\u89c2\u5bdf', '\u6f5c\u5165', '\u63a2\u7d22', '\u63a2\u67e5', '\u627e', 'explore')) return 'exploration';
    if (has('\u95ee', '\u8c08', '\u4ea4\u6d89', '\u8bf4\u670d', '\u8bd5\u63a2', '\u5546\u8bae', '\u6c9f\u901a', 'social')) return 'social_negotiate';
    if (has('\u4f11\u606f', '\u7761', '\u6062\u590d', '\u5403', '\u505a\u996d', '\u653e\u677e', '\u65e5\u5e38', 'rest')) return 'rest';
    if (has('\u4fee\u70bc', '\u8bad\u7ec3', '\u7ec3\u4e60', '\u5b66\u4e60', '\u7a81\u7834', 'train')) return 'train';
    if (has('\u4efb\u52a1', '\u59d4\u6258', '\u76ee\u6807', '\u4ea4\u4ed8', 'quest')) return 'quest_progress';
    if (has('\u8c1c', '\u79d8\u5bc6', '\u5f02\u5e38', '\u771f\u76f8', 'mystery')) return 'mystery';
    if (has('\u5371\u9669', '\u5192\u9669', '\u8d4c', '\u5b64\u6ce8\u4e00\u63b7', 'risk')) return 'danger';
    return 'neutral';
  },

  _buildChoiceStyleDirective(choiceText, choiceType, styleMemory) {
    const type = choiceType || this._inferChoiceType(choiceText);
    const profiles = {
      combat_win: ['战斗推进', '完整呈现行动、交锋、反馈与胜利依据。', '不能一句带过过程，胜利不能无依据。'],
      combat_loss: ['战斗受挫', '呈现失误、阻碍、伤害或资源代价，并让失败产生后续影响。', '不能无铺垫昏迷跳场，状态变化必须同步。'],
      combat_risk: ['冒险战斗', '先执行玩家行动，再呈现阻碍、反击和风险代价。', '主角不能无代价开挂，敌人不能突然降智。'],
      exploration: ['探索发现', '通过当前场景中可获得的痕迹或信息逐步形成发现。', '不能用上帝旁白直接宣布角色尚不知道的真相。'],
      exploration_risk: ['危险探索', '探索所得与威胁同时推进，主角必须基于已有信息判断。', '不能安全白捡关键信息。'],
      exploration_loot: ['发现收获', '写清发现来源、获得过程和必要代价，收获贴合世界观。', '不能凭空掉落物品。'],
      social_success: ['社交推进', '双方说辞与反应必须形成可追溯的关系或信息变化。', '不能只宣布对方被说服而省略过程。'],
      social_fail: ['社交受阻', '误解、立场或信息差造成失败，并留下可继续处理的后果。', '不能用无意义沉默糊弄结果。'],
      social_negotiate: ['试探交涉', '每轮交流都应推动条件、信息或关系发生变化。', '不能让任何一方无理由让步。'],
      rest: ['日常缓冲', '完成休息或生活行动，并交代它对状态和未完成事件的影响。', '不能完全切断主线。'],
      train: ['成长训练', '呈现训练步骤、反馈、消耗和与投入相符的进步。', '不能一句话直接升级。'],
      quest_progress: ['任务推进', '明确目标、阻碍和能够证明进展的结果。', '不能原地踏步。'],
      mystery: ['悬疑揭示', '只揭示当前证据足以支持的部分，保留尚无依据的未知。', '不能一次性讲穿全部谜底。'],
      danger: ['危机处理', '明确压力来源、限制条件和主角的应对。', '不能忽略当前危机。'],
      escape: ['逃离脱身', '交代逃离路径、阻碍、追击或代价。', '不能突然无条件安全。'],
      neutral: ['承接推进', '严格承接玩家行动，写出执行、反馈与新变化。', '不能跳过选择或只做空泛总结。'],
    };
    const p = profiles[type] || profiles.neutral;
    let out = `
【本节行动逻辑——只约束发生什么，不规定怎么写】
`;
    out += '玩家行动类型：' + type + ' / ' + p[0] + '\n';
    out += '内容目标：' + p[1] + '\n';
    out += '逻辑限制：' + p[2] + '\n';
    out += '开头应及时承接玩家行动，不得脱离当前世界观和已有关系。\n';
    if (styleMemory) out += '用户文风控制视角、句长、段落、用词、修辞、对话比例、描写密度、心理表达、节奏与氛围；行动类型不得覆盖这些文风维度。\n';
    return out + '\n';
  },

  // === 选项解析 ===
  _parseChoicesFromText(rawText) {
    const lines = rawText.split('\n').filter(l => l.trim());
    const choices = [];
    for (let line of lines) {
      line = line.replace(/^[\d]+[.)、\s]*/, '').replace(/^[-*•·]\s*/, '').trim();
      if (!line) continue;
      let tag = '';
      let type = '';
      let text = line;
      const typeMatch = line.match(/\[type:([^\]]+)\]|\u3010type:([^\u3011]+)\u3011/i);
      if (typeMatch) type = (typeMatch[1] || typeMatch[2] || '').trim();
      // 开头的标签
      if (line.startsWith('【推荐】') || line.startsWith('[推荐]')) { tag = 'recommended'; text = line.replace(/^[【\[]推荐[】\]]\s*/, ''); }
      else if (line.startsWith('【高风险】') || line.startsWith('[高风险]')) { tag = 'high_risk'; text = line.replace(/^[【\[]高风险[】\]]\s*/, ''); }
      else if (line.startsWith('*')) { tag = 'recommended'; text = line.slice(1).trim(); }
      // 清理文本中残留的内部代码（无论开头还是结尾）
      text = text
        .replace(/\[type:[^\]]*\]/gi, '')
        .replace(/\[tag:[^\]]*\]/gi, '')
        .replace(/【type:[^】]*】/g, '')
        .replace(/【tag:[^】]*】/g, '')
        .replace(/\s*\[recommended\]/gi, '')
        .replace(/\s*\[high_risk\]/gi, '')
        .replace(/\s*\[combat_[^\]]*\]/gi, '')
        .replace(/\s*\[exploration_[^\]]*\]/gi, '')
        .replace(/\s*\[social_[^\]]*\]/gi, '')
        .replace(/\s*\[quest_[^\]]*\]/gi, '')
        .trim();
      if (text) choices.push({ text, tag, type: type || this._inferChoiceType(text), effects: {} });
    }
    return choices.length >= 3 ? choices : AIBridge._DEFAULT_CHOICES;
  },

  _DEFAULT_CHOICES: [
    { text: '继续前进，探索前方的未知', tag: '', effects: {} },
    { text: '谨慎观察周围环境再做决定', tag: 'recommended', effects: {} },
    { text: '暂时停下，整理思路和装备', tag: '', effects: {} },
  ],

  // === 状态更新解析 ===
  _parseStatusUpdates(raw) {
    if (!raw || !raw.trim()) return {};
    const updates = {};
    const lines = raw.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Normalize Markdown status rows before parsing.
      line = line
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*\u2022\u00b7]\s+/, '')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .trim();

      let key = '', val = '';
      const bracketField = line.match(/^\u3010([^\u3011]+)\u3011\s*[:\uff1a]?\s*(.+)$/);
      if (bracketField) {
        key = bracketField[1].trim();
        val = bracketField[2].trim();
      } else {
        const colonIdx = line.search(/[:\uff1a]/);
        if (colonIdx < 0) continue;
        key = line.slice(0, colonIdx).trim();
        val = line.slice(colonIdx + 1).trim();
      }
      key = key.replace(/^[\u3010[]|[\u3011\]]$/g, '').trim();
      val = val.replace(/^[-\u2013\u2014]\s*/, '').trim();
      if (!key || !val) continue;

      if (['健康', 'health'].includes(key)) updates.health = val;
      else if (['心情', 'mood'].includes(key)) updates.mood = val;
      else if (['伏笔埋设', 'foreshadowing'].includes(key)) updates.foreshadowing = val;
      else if (['level', '等级', '品阶'].includes(key)) {
        const n = this._extractInt(val);
        if (n > 0) updates.level = n; else updates.rank = val;
      }
      else if (['rank', '段位', '境界'].includes(key)) updates.rank = val;
      else if (['exp', '经验', '经验值'].includes(key)) {
        updates.exp = this._extractInt(val.includes('/') ? val.split('/')[0] : val);
      }
      else if (['expToNext', '升级所需', '下一级'].includes(key)) {
        updates.expToNext = this._extractInt(val.includes('/') ? val.split('/').slice(-1)[0] : val);
      }
      else if (['关系变化', 'relation_changes'].includes(key)) {
        const changes = {};
        for (const part of val.split('|')) {
          const p = part.trim();
          if (p.includes('+')) {
            const [n, v] = p.split('+');
            changes[n.trim()] = this._extractInt(v);
          } else if (p.includes('-')) {
            const [n, v] = p.split('-');
            changes[n.trim()] = -this._extractInt(v);
          }
        }
        if (Object.keys(changes).length) updates.relation_changes = changes;
      }
      else if (['新技能', 'new_skills'].includes(key)) {
        updates.new_skills = val.split('|').map(s => {
          const m = s.match(/^(.+?)(?:\((.+)\))?$/);
          const name = (m ? m[1] : s).trim();
          const detail = m && m[2] ? m[2].trim() : '';
          return { name, detail, level: 1, proficiency: '初学' };
        });
      }
      else if (['技能升级', 'skill_upgrades'].includes(key)) {
        updates.skill_upgrades = val.split('|').map(s => {
          const name = s.replace(/\(.*\)$/, '').trim();
          let level = null, proficiency = null;
          const lvMatch = s.match(/Lv\.?(\d+)/i) || s.match(/Lv(\d+)/);
          if (lvMatch) level = parseInt(lvMatch[1]);
          const profMatch = s.match(/[（(]([^）)]+)[）)]$/);
          if (profMatch) proficiency = profMatch[1];
          return { name, level, proficiency };
        });
      }
      else if (['新物品', 'new_items'].includes(key)) {
        const items = [];
        for (const part of val.split('|')) {
          const p = part.trim();
          if (!p || p.startsWith('无')) continue;
          const xIdx = p.lastIndexOf('x');
          const name = xIdx > 0 ? p.slice(0, xIdx).trim() : p;
          const qty = xIdx > 0 ? this._extractInt(p.slice(xIdx + 1)) : 1;
          if (!name || name === '无' || name === '没有' || name === '暂无') continue;
          items.push({ name, qty: qty || 1, desc: '' });
        }
        if (items.length) updates.new_items = items;
      }
      // v4.0.1: 新地点（AI剧情中首次出现的地点）
      else if (['新地点', 'new_locations'].includes(key)) {
        var locs = [];
        for (var part of val.split('|')) {
          var p = part.trim();
          if (!p || p === '无' || p === '没有' || p === '暂无' || p.startsWith('无')) continue;
          var dashIdx = p.indexOf('——');
          var colonIdx = p.indexOf(':');
          var sepIdx = dashIdx > 0 ? dashIdx : (colonIdx > 0 ? colonIdx : -1);
          if (sepIdx > 0) {
            locs.push({ name: p.slice(0, sepIdx).trim(), description: p.slice(sepIdx + (dashIdx > 0 ? 2 : 1)).trim() });
          } else {
            locs.push({ name: p, description: '' });
          }
        }
        if (locs.length) updates.new_locations = locs;
      }
      // v4.0.1: 新功法/能力（AI剧情中首次出现的功法）
      else if (['新功法', '新能力', 'new_abilities'].includes(key)) {
        var abilities = [];
        for (var part of val.split('|')) {
          var p = part.trim();
          if (!p || p === '无' || p === '没有' || p === '暂无' || p.startsWith('无')) continue;
          var dashIdx = p.indexOf('——');
          var colonIdx = p.indexOf(':');
          var sepIdx = dashIdx > 0 ? dashIdx : (colonIdx > 0 ? colonIdx : -1);
          if (sepIdx > 0) {
            abilities.push({ name: p.slice(0, sepIdx).trim(), description: p.slice(sepIdx + (dashIdx > 0 ? 2 : 1)).trim() });
          } else {
            abilities.push({ name: p, description: '' });
          }
        }
        if (abilities.length) updates.new_abilities = abilities;
      }
    }
    return updates;
  },

  // === 故事响应解析 ===
  _parseStoryResponse(content) {
    // 人物档案
    const characters = [];
    if (content.includes('【人物档案】')) {
      let archiveBlock = content.split('【人物档案】', 2)[1];
      for (const sep of ['【选项】', '【状态】']) {
        if (archiveBlock.includes(sep)) archiveBlock = archiveBlock.split(sep, 2)[0];
      }
      const FIELD_MAP = { '关系': 'relation', '外貌': 'appearance', '性格': 'personality', '备注': 'notes' };
      const charEntries = archiveBlock.split('\n').filter(l => {
        const t = l.trim();
        return t.startsWith('【') && t.endsWith('】') && !['人物档案', '选项', '状态'].includes(t.replace(/[【】]/g, ''));
      });
      for (const entryLine of charEntries) {
        const name = entryLine.replace(/[【】]/g, '').trim();
        if (!name || name === '主角') continue;
        const char = { name, relation: '', appearance: '', personality: '', notes: '' };
        const idx = archiveBlock.indexOf(entryLine);
        if (idx < 0) continue;
        const remaining = archiveBlock.slice(idx + entryLine.length);
        for (const line of remaining.split('\n')) {
          const t = line.trim();
          if (t.startsWith('【') && t.endsWith('】')) break;
          for (const [cn, en] of Object.entries(FIELD_MAP)) {
            if (t.startsWith(cn + '：') || t.startsWith(cn + ':')) {
              char[en] = t.slice(cn.length + 1).trim();
            }
          }
        }
        characters.push(char);
      }
    }

    const parts = content.split('【选项】');
    let storyText = parts[0].trim();
    if (storyText.includes('【人物档案】')) storyText = storyText.split('【人物档案】')[0].trim();
    const remaining = parts.length > 1 ? parts[1].trim() : '';

    let choicesRaw = remaining, statusRaw = '';
    if (remaining.includes('【状态】')) {
      [choicesRaw, statusRaw] = remaining.split('【状态】', 2);
    }

    const choices = this._parseChoicesFromText(choicesRaw);
    const status = this._parseStatusUpdates(statusRaw);

    // DeepSeek may emit Markdown status rows without a formal status block.
    const fallbackStatus = this._parseStatusUpdates(content);
    for (const [key, value] of Object.entries(fallbackStatus)) {
      if (status[key] == null) status[key] = value;
    }
    return { storyText, choices, status, characters };
  },

  // === 上下文构建器 ===
  _buildBiosContext(bios) {
    if (!bios || !bios.length) return '';
    let ctx = '\n【人物小传】\n';
    for (const b of bios) {
      if (!b || !b.name) continue;
      ctx += '【' + b.name + '】';
      if (b.role) ctx += ' 身份：' + b.role;
      if (b.appearance) ctx += ' 外貌：' + b.appearance;
      if (b.personality) ctx += ' 性格：' + b.personality;
      if (b.bg) ctx += ' 背景：' + b.bg;
      if (b.ability) ctx += ' 能力：' + b.ability;
      if (b.goal) ctx += ' 动机：' + b.goal;
      if (b.notes) ctx += ' 备注：' + b.notes;
      ctx += '\n';
    }
    return ctx;
  },

  _buildPlotPlanContext(pacingContext) {
    // v3.5: pacingContext is from PlotPlanManager.getPacingContext()
    // LiveContext now handles pacing directives; this only provides phase progress data
    if (!pacingContext) return '';
    return '\n' + pacingContext + '\n';
  },

  _buildRetryContext(retry) {
    if (!retry) return '';
    return '\n【重要提示】玩家撤销了选择"' + (retry.text || retry.choice || '') +
      '"，这是一个新的分支线。请探索不同的发展方向，不要重复之前的选项和剧情走向。\n';
  },

  _buildLorebookContext(lorebook, storyLog, bios, locations, factions) {
    if (!lorebook || !lorebook.length) return '';
    const recentText = (storyLog || '').slice(-5000);
    const matched = lorebook.filter(e => {
      if (!e || !e.keyword || !e.content) return false;
      const kw = e.keyword.toLowerCase();
      return recentText.toLowerCase().includes(kw) ||
             (locations || '').toLowerCase().includes(kw) ||
             (factions || '').toLowerCase().includes(kw) ||
             (bios || []).some(b => (b.name || '').toLowerCase().includes(kw));
    });
    if (!matched.length) return '';
    matched.sort((a, b) => (b.priority || 1) - (a.priority || 1));
    return '\n【世界观书——触发词条】\n' +
      matched.map(e => '【' + e.keyword + '】' + e.content).join('\n') + '\n';
  },

  // === 故事 Prompt 构建（移植自 _build_story_prompt） ===
  _buildStoryPrompt(data) {
    const genre = data.genre || '未知';
    const worldName = data.world_name || '';
    const worldDesc = data.world_desc || '';
    const era = data.era || '';
    const locations = data.locations || '';
    const factions = data.factions || '';
    const powerSystem = data.power_system || '';
    const player = data.player || {};
    const choice = data.choice || '';
    const choiceType = data.choice_type || this._inferChoiceType(choice);
    const chapter = data.chapter || 1;
    const scene = data.scene || 1;
    const history = data.history || [];
    const storyLog = data.story_log || '';
    const bios = data.character_bios || [];
    const plotPlan = data.plot_plan || null;
    const retryContext = data.retry_context || null;
    const lorebook = data.lorebook || [];
    const authorsNote = data.authors_note || data.post_history_instructions || '';
    const chapterSummaries = data.chapter_summaries || '';
    const scenarioRules = data.scenario_rules || '';
    const styleMemory = (data.style_memory || '').trim();
    const styleStrength = data.style_strength || 'strong';
    const foreshadowingPrompt = data.foreshadowing_prompt || '';
    const plotTransition = data.plot_transition || '';
    const liveContext = data.live_context || '';
    const plotSuggestions = data.plot_suggestions || [];

    // Lorebook context
    const lorebookCtx = this._buildLorebookContext(lorebook, storyLog, bios, locations, factions);

    // Author's note
    let authorsNoteText = '';
    if (authorsNote) {
      let anText = authorsNote, anDepth = 0;
      if (typeof authorsNote === 'string' && authorsNote.startsWith('{')) {
        try { const p = JSON.parse(authorsNote); anText = p.text || authorsNote; anDepth = p.depth || 0; } catch(e) {}
      }
      authorsNoteText = '\n【作者注】' + anText + '\n';
    }

    // History
    let histText = '';
    if (history && history.length) {
      const recent = history.slice(-40);
      histText = recent.map(h => {
        const ps = h.playerState || {};
        const si = ps.health ? '[体:' + ps.health + ' 心:' + (ps.mood || '?') + ' 天:' + (ps.days || '?') + ']' : '';
        return '  · 选择' + (h.choice || '') + ' ' + si;
      }).join('\n');
    }

    // Story log
    let storyLogText = '';
    if (storyLog) {
      const MAX_RECENT = 60000, MAX_HEAD = 5000;
      const total = storyLog.length;
      if (total <= MAX_RECENT + MAX_HEAD) {
        storyLogText = '\n【故事正文（完整）】\n' + storyLog;
      } else {
        storyLogText = '\n【故事正文】\n\n【故事开端（前情提要）】\n' + storyLog.slice(0, MAX_HEAD) +
          '\n\n...（中间' + (total - MAX_HEAD - MAX_RECENT) + '字略去）...\n\n【最近进展】\n' + storyLog.slice(-MAX_RECENT);
      }
    }

    // Chapter summaries
    let summariesText = '';
    if (chapterSummaries) summariesText = '\n【章节摘要（仅供快速回顾）】\n' + chapterSummaries.slice(0, 3000) + '\n';

    // Relations
    const relations = player.relations || {};
    const relationsStr = Object.entries(relations).map(([k, v]) => k + '(亲密度' + this._extractInt(v) + ')').join(', ') || '无';

    // Skills
    const skills = player.skills || [];
    const skillsStr = skills.map(s => {
      const parts = [s.name || '?'];
      if (s.level) parts.push('Lv.' + s.level);
      if (s.proficiency) parts.push('（' + s.proficiency + '）');
      if (s.type && s.type !== '被动') parts.push('[' + s.type + ']');
      return parts.join(' ');
    }).join('，') || '无';

    // Items
    let invStr = '无';
    const inv = player.inventory || player.items || [];
    if (inv) {
      const parts = [];
      if (inv.bag) {
        for (const item of inv.bag) parts.push(item.name + 'x' + (item.qty || 1));
        for (const [slot, item] of Object.entries(inv.equipped || {})) parts.push('【装备】' + item.name + '（' + slot + '）');
      } else if (Array.isArray(inv)) {
        for (const item of inv) parts.push(item.name + 'x' + (item.qty || 1));
      }
      if (parts.length) invStr = parts.join('，');
    }

    // Level
    const level = player.level || 1;
    const rank = player.rank || '';
    const expVal = player.exp || 0;
    const expNext = player.expToNext || 100;
    const levelStr = '等级：Lv.' + level + (rank ? '（' + rank + '）' : '');

    // Dynamic stats
    const stats = player.stats || {};
    const statsLayout = player.statsLayout;
    let statsStr = '';
    if (statsLayout && statsLayout.stats) {
      statsStr = statsLayout.stats.map(s => {
        const sid = s.id || '';
        return (s.name || sid) + '：' + (stats[sid] != null ? stats[sid] : (s.value || 0));
      }).join('，');
    }

    const strengthText = styleStrength === 'light'
      ? '轻度：保留风格辨识度，但优先保证可读性。'
      : styleStrength === 'standard'
        ? '标准：持续执行所有风格维度，避免中途回到默认文风。'
        : '强制模仿：除剧情事实、角色认知边界和输出格式外，正文表达必须以用户文风为最高优先级。';

    let prompt = '';
    if (styleMemory) {
      prompt += `【用户文风——正文表达最高优先级】
${styleMemory}
模仿强度：${strengthText}
必须让该文风在视角、句长、段落结构、词汇、修辞、对话比例、描写密度、心理表达、节奏与氛围上产生明显变化。
若其他提示对这些表达维度提出冲突要求，以本区块为准；其他规则只约束剧情事实、行动逻辑、角色认知和输出格式。

`;
    } else {
      prompt += `【默认文风（仅在用户未设置文风时启用）】
采用清晰流畅的第二人称互动小说叙事，句式自然、信息明确。

`;
    }

    prompt += '你是一个专业小说家，正在创作一部「' + genre + '」题材的互动小说。\n\n' +
      this._buildChoiceStyleDirective(choice, choiceType, styleMemory) +
      '【故事背景】\n' +
      '类型：' + genre + '\n' +
      '世界观：' + (worldDesc || '').slice(0, 500) + '\n' +
      '时代：' + era + '\n' +
      '重要地点：' + locations + '\n' +
      '势力分布：' + (factions || '').slice(0, 300) + '\n' +
      '能力体系：' + (powerSystem || '').slice(0, 200) + '\n\n';

    if (data.writing_rules) prompt += data.writing_rules + '\n\n';

    prompt +=
      '【主角设定】\n' +
      '姓名：' + (player.name || '') + '\n' +
      '年龄：' + (player.age || '') + '\n' +
      '性别：' + (player.sex || '') + '\n' +
      '性格：' + (player.personality || '') + '\n' +
      '背景：' + (player.background || '').slice(0, 200) + '\n' +
      '能力：' + (player.ability || '').slice(0, 200) + '\n' +
      '目标：' + (player.goal || '') + '\n' +
      levelStr + '\n' +
      '经验值：' + expVal + '/' + expNext + '\n' +
      '当前属性：' + (statsStr || '未设定') + '\n' +
      '当前健康：' + (player.health || '健康') + '\n' +
      '当前心情：' + (player.mood || '平淡') + '\n' +
      '已有技能：' + skillsStr + '\n' +
      '已有物品：' + invStr + '\n' +
      '人际关系：' + relationsStr + '\n\n';

    prompt += this._buildBiosContext(bios);
    prompt += this._buildPlotPlanContext(plotPlan);

    prompt += '【世界边界——严格遵守】\n' +
      '你正在创作的世界是「' + worldName + '」（' + genre + '题材），所有剧情、角色、设定必须在这个世界框架内展开。\n\n' +
      '以下规则不可违反：\n' +
      '1. 只能使用【人物小传】中已经列出的角色。禁止凭空引入任何不在名单中的角色。\n' +
      '2. 禁止引用或暗示其他世界、其他故事线、其他主角的存在。\n' +
      '3. 如果需要创建新角色，他们的名字、背景、能力必须贴合当前世界观。\n' +
      '4. 所有地点、组织、势力的名称必须与【故事背景】中提供的一致。\n\n' +
      '【写作红线——禁止出现】\n' +
      'P0（绝对禁止）：\n' +
      '- 感悟式结尾（"他明白了…""她终于懂得…"）\n' +
      '- 感叹式结尾（"真是太…""多么…"）\n' +
      '- 上帝视角（"所有人没想到…""全书第x章…"）\n' +
      '- 明显AI词汇（"众所周知""不言而喻"等）\n\n' +
      '【状态区块输出格式——严格遵循】\n' +
      '【状态】区块中每条格式为"key: value"，支持以下字段：\n' +
      '- 健康：健康/轻伤/重伤/濒死\n' +
      '- 心情：平淡/开心/愤怒/悲伤/恐惧\n' +
      '- level: 3（等级纯数字）\n' +
      '- 品阶：筑基三层（境界名称）\n' +
      '- 经验：150/300\n' +
      '- 关系变化：张三+10|李四-5\n' +
      '- 新技能：天罡北斗拳(威力大幅提升)|灵力感知\n' +
      '- 技能升级：天罡北斗拳(Lv3,大成)\n' +
      '- 新物品：玄铁剑x1|灵石x5\n' +
      '只输出本段剧情中新获得或消耗的物品，不要重复已有物品！\n' +
      '- 新地点：凌霄峰——云端之上的仙山|幽冥谷(洞穴):暗影丛生之地\n' +
      '格式：地名——描述 或 地名(类型):描述，多条用|分隔，只写本段首次出现的地点\n' +
      '- 新功法：太虚剑诀——以意御剑的高级剑法|灵息诀(辅助):增强感知\n' +
      '格式：功法名——描述 或 功法名(类型):描述，多条用|分隔，只写本段首次出现的功法/能力\n\n';

    if (lorebookCtx) prompt += lorebookCtx + '\n';
    if (summariesText) prompt += summariesText + '\n';

    prompt += '【当前进度】第' + chapter + '章 第' + scene + '节\n\n' +
      '【生成要求——必须遵守】\n' +
      '将主角的等级、技能、物品、健康状态自然地融入剧情中。\n\n';

    if (authorsNoteText) prompt += authorsNoteText;
    if (scenarioRules) prompt += scenarioRules;
    if (foreshadowingPrompt) prompt += foreshadowingPrompt;
    if (plotTransition) prompt += '\n【阶段转换提示——重要】\n' + plotTransition + '\n';
    if (liveContext) prompt += '\n' + liveContext + '\n';
    if (plotSuggestions.length) {
      prompt += '\n【AI助手剧情建议——请参考执行】\n';
      prompt += '以下是玩家通过AI助手提出的剧情建议，请在本次生成中自然地融入这些剧情方向：\n';
      plotSuggestions.forEach(function(s) { prompt += '  · ' + s + '\n'; });
      prompt += '融合要求：将这些建议作为剧情发展的灵感，但不要生硬照搬；自然地编织进故事中，让它们像是故事本身的有机组成部分。\n';
    }
    prompt += this._buildRetryContext(retryContext);

    prompt += '【剧情回顾·选择记录】\n' + (histText || '无') + '\n';
    if (storyLogText) prompt += storyLogText + '\n';

    prompt += '\n【▶▶▶ 本节唯一主线——玩家行动 ◀◀◀】\n' + choice + '\n\n' +
      '⚠ 以上是玩家在本节执行的操作。你现在开始写下一段剧情，必须从玩家这个操作出发。\n' +
      '规则：\n' +
      '1. 优先执行玩家操作——即使失败，也必须描写主角尝试执行这个操作的过程\n' +
      '2. 禁止忽略玩家的操作、禁止写主角做了别的事\n' +
      '3. 操作可以失败、可以遇到阻碍，但主角的意图必须是执行上述操作\n';

    if (styleMemory) {
      prompt += '\n【输出前最终文风校验】正文从第一段到最后一段都必须持续执行用户文风；不要退回默认第二人称、固定短句、克制对白、感官白描或其他模板写法，除非用户文风本身如此要求。\n';
    }

    return prompt;
  },

  // ═══════════════════════════════════════════
  // 高层 API（匹配旧服务端接口）
  // ═══════════════════════════════════════════

  // === 字段生成（替代 /generate） ===
  PROMPTS: {
    'w-desc': '【唯一性要求：#REQ_{unique}】为「{genre}」题材创作世界观概述（200-350字）。世界名称：{world_name}。已有设定：{existing}。直接输出。',
    'w-era': '【唯一性：#REQ_{unique}】确定时代背景（40-80字）。世界观：{world_desc}。已有设定：{existing}。直接输出。',
    'w-locations': '【唯一性：#REQ_{unique}】设计4-6个核心地点。世界观：{world_desc}。时代：{era}。格式：地名——简短描述。直接输出。',
    'w-factions-bulk': '【唯一性：#REQ_{unique}】设计4-6个势力。不要开场白。每行一个：势力名（立场）：简介。题材：{genre}。世界观：{world_desc}。已有设定：{existing}。直接输出。',
    'w-power-system': '【唯一性：#REQ_{unique}】设计能力等级体系（100-200字）。世界观：{world_desc}。势力：{factions}。已有设定：{existing}。从低到高排列。直接输出。',
    'c-name': '【冒险类型】{genre}。性别：{sex}。年龄：{age}。世界观：{world_desc}。取一个名字（2-4汉字）。直接输出名字。',
    'c-personality': '【冒险类型】{genre}。姓名：{name}。世界观：{world_desc}。用80-120字描述主角性格。直接输出。',
    'c-one-line': '【冒险类型】{genre}。姓名：{name}。性格：{personality}。用一句话（30-50字）概括主角。直接输出。',
    'c-appearance': '【冒险类型】{genre}。姓名：{name}。性格：{personality}。世界观：{world_desc}。用60-100字描述主角外貌。直接输出。',
    'c-background': '【冒险类型】{genre}。姓名：{name}。性格：{personality}。世界观：{world_desc}。用100-150字写主角背景。直接输出。',
    'c-ability': '【冒险类型】{genre}。姓名：{name}。背景：{background}。能力体系：{power_system}。用100-150字设计主角初始能力。直接输出。',
    'c-goal': '【冒险类型】{genre}。姓名：{name}。背景：{background}。用30-50字确定主角初始目标/动机。直接输出。',
  },

  _getExisting(data) {
    const labels = {
      world_name: '世界名称', world_desc: '世界观概述', era: '时代背景',
      locations: '核心地点', factions: '势力设定', power_system: '能力等级体系',
      name: '姓名', sex: '性别', age: '年龄', personality: '性格',
      one_line: '一句话', appearance: '外貌', background: '背景',
      ability: '能力', goal: '目标',
    };
    const lines = [];
    for (const [k, v] of Object.entries(labels)) {
      const val = (data[k] || '').trim();
      if (val) lines.push(v + ': ' + val);
    }
    return lines.join('\n') || '无';
  },

  async generate(fieldId, data) {
    if (!this._checkRate('field')) throw new Error('请求过于频繁');
    const template = this.PROMPTS[fieldId];
    if (!template) throw new Error('Unknown field: ' + fieldId);

    let prompt = template
      .replace('{genre}', data.genre || '未知')
      .replace('{unique}', Math.random().toString(36).slice(2, 8))
      .replace('{world_name}', data.world_name || '')
      .replace('{world_desc}', data.world_desc || '')
      .replace('{era}', data.era || '')
      .replace('{factions}', data.factions || '')
      .replace('{power_system}', data.power_system || '')
      .replace('{name}', data.name || '')
      .replace('{sex}', data.sex || '男')
      .replace('{age}', data.age || '')
      .replace('{personality}', data.personality || '')
      .replace('{background}', data.background || '')
      .replace('{existing}', this._getExisting(data));

    const tokenBudget = { 'w-desc': 400, 'w-era': 100, 'w-locations': 200, 'w-factions-bulk': 250,
      'w-power-system': 300, 'c-name': 20, 'c-personality': 200, 'c-one-line': 80,
      'c-appearance': 150, 'c-background': 250, 'c-ability': 250, 'c-goal': 80 }[fieldId] || 300;

    return await this._callAPI(prompt, tokenBudget, 1.0);
  },

  // === 故事续写（替代 /story 和 /story/stream） ===
  async storyGenerate(data) {
    if (!this._checkRate('story')) throw new Error('请求过于频繁');
    const prompt = this._buildStoryPrompt(data);
    const isOpening = data.choice && data.choice.includes('故事的开端');
    const maxTokens = isOpening ? 2500 : 4000;
    const content = await this._callAPI(prompt, maxTokens, 0.85, 2);
    const result = this._parseStoryResponse(content);
    return { ok: true, story: result.storyText, choices: result.choices,
      status_updates: result.status, characters: result.characters };
  },

  // === 流式故事续写 ===
  async *storyStream(data) {
    if (!this._checkRate('story')) throw new Error('请求过于频繁');
    const prompt = this._buildStoryPrompt(data);
    const isOpening = data.choice && data.choice.includes('故事的开端');
    const maxTokens = isOpening ? 2500 : 4000;

    let fullText = '';
    // 手动消费异步迭代器（兼容不支持 for-await-of 的引擎）
    const streamIter = this._callAPIStream(prompt, maxTokens, 0.85);
    let iterResult;
    while (true) {
      try { iterResult = await streamIter.next(); } catch(e) { throw e; }
      if (iterResult.done) break;
      const chunk = iterResult.value;
      fullText += chunk;
      yield { type: 'chunk', text: chunk };
    }

    const result = this._parseStoryResponse(fullText);
    yield { type: 'done', story: result.storyText, choices: result.choices,
      status_updates: result.status, characters: result.characters };
  },

  // === 角色属性面板（替代 /player-layout） ===
  async generatePlayerLayout(data) {
    const prompt = '为「' + (data.genre || '') + '」题材的主角「' + (data.player_name || '') +
      '」设计属性面板。能力体系：' + (data.power_system || '').slice(0, 200) +
      '。能力描述：' + (data.ability || '').slice(0, 200) +
      '。输出纯JSON：{"stats":[{"id":"str","name":"力量","value":10,"max":100},...],"layout":"horizontal"}。6-8个属性。';
    const content = await this._callAPI(prompt, 400, 0.8, 1);
    return this._safeJsonParse(content, 'player-layout');
  },

  // === 评估自定义选项（替代 /evaluate-choice） ===
  async evaluateChoice(data) {
    const prompt = '玩家输入了一个自定义行动："' + data.choice + '"。\n' +
      '类型：' + (data.genre || '') + '\n' +
      '世界观：' + (data.world_desc || '').slice(0, 300) + '\n' +
      '主角能力：' + (data.player_ability || '').slice(0, 200) + '\n' +
      '当前心情：' + (data.player_mood || '') + '\n' +
      '当前健康：' + (data.player_health || '') + '\n' +
      '评估这个行动的风险等级和可能的影响。输出JSON：{"impact":"safe/moderate/risky/fatal","reason":"简短原因"}。';
    const content = await this._callAPI(prompt, 200, 0.7, 1);
    return this._safeJsonParse(content, 'evaluate-choice');
  },

  // === 一键生成世界（非流式，保留界面酷炫加载动画） ===
  async generateCompleteWorld(data) {
    const keyword = data.keyword || '';
    const genre = data.genre || (keyword || '未知');
    const worldName = data.world_name || (keyword || '');
    let prompt = '为「' + genre + '」题材创作完整世界观。';
    if (keyword && keyword !== genre) prompt += '概念关键词：' + keyword + '。';
    if (worldName) prompt += '世界名称：' + worldName + '。';
    prompt += '输出纯JSON（只返回JSON，不要任何其他文字）：{"world_name":"根据世界观核心概念提炼一个2-6字的世界名称","genre":"从以下列表选一个最匹配的：东方玄幻、仙侠修真、西方魔幻、科幻末世、都市异能、重生穿越、游戏异界、悬疑灵异、历史架空、武侠江湖——或自行概括一个2-6字的类型","world_desc":"...","era":"...","locations":"地名——描述（至少3个）...","factions":"势力名（立场）：简介...","power_system":"...","protagonist":{"name":"2-3字中文姓名","age":18-40的整数,"sex":"男/女","personality":"性格描述","oneLine":"一句身份概括","appearance":"外貌描述","background":"身世背景","ability":"能力/特长","goal":"当前目标"}}。每个字段独立完整。';

    const content = await this._callAPI(prompt, 800, 0.9, 1, 120000);
    if (!content || !content.trim()) throw new Error('AI返回了空内容');

    try {
      return this._safeJsonParse(content, 'complete-world');
    } catch(parseErr) {
      const preview = content.slice(0, 500).replace(/\n/g, ' ');
      throw new Error('AI返回格式不正确，无法解析。预览：' + preview);
    }
  },

  // === 配置验证（使用 XHR 避免 WebView2 fetch 挂起） ===
  async testConfig(key, url, model) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/config/test', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 20000;
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch(e) { resolve({ ok: false, error: '响应解析失败（状态码 ' + xhr.status + '）' }); }
      };
      xhr.onerror = () => resolve({ ok: false, error: '网络请求失败，请确认服务端已启动（localhost:8765）' });
      xhr.ontimeout = () => resolve({ ok: false, error: '验证超时（20秒），请检查 API Key 是否正确、网络是否通畅' });
      try {
        xhr.send(JSON.stringify({ api_key: key, api_url: url || 'https://api.deepseek.com/v1/chat/completions', api_model: model || 'deepseek-chat' }));
      } catch(e) {
        resolve({ ok: false, error: '发送请求失败：' + e.message });
      }
    });
  },

  // === 文笔记忆 ===
  _styleMemory: '',
  getStyle() { return this._styleMemory; },
  clearStyle() { this._styleMemory = ''; },

  async learnStyle(text) {
    const prompt = '分析以下小说的文笔风格特征。从句子节奏、用词偏好、对话风格、描写方式、视角心理、整体氛围6个方面分析。直接输出分析结果，不要加入其他内容。\n\n范文：\n' + text.slice(0, 3000);
    const content = await this._callAPI(prompt, 800, 0.7, 1);
    this._styleMemory = content;
    return content;
  },

  /** 从自然语言描述生成风格规则（无需贴范文） */
  async learnStyleFromDesc(desc) {
    const prompt = '用户想要以下写作风格：\n"""\n' + desc + '\n"""\n\n请参考内置文笔预设的格式，从【句子节奏】【用词偏好】【对话风格】【描写方式】【视角与心理】【整体氛围】6个方面，生成一份结构化的文笔风格规则。每个方面一句话概括。直接输出，不要加废话。';
    const content = await this._callAPI(prompt, 800, 0.7, 1);
    this._styleMemory = content;
    return content;
  },

  /** v4.0.1: AI 补全人物空白字段 */
  async fillCharacterFields(name, genre, worldName, existing, fieldsToFill, overwrite) {
    var fieldMap = {
      appearance: '外貌特征（身材、发色、衣着、标志性特征）',
      personality: '性格描述（性格层次、行为习惯、口头禅）',
      bg: '背景故事（出身、关键经历、转折事件）',
      ability: '能力设定（天赋、技能、战斗风格）',
      goal: '目标/动机（想要什么、为什么）'
    };
    var fieldsDesc = fieldsToFill.map(function(f) { return f + '（' + (fieldMap[f] || f) + '）'; }).join('、');

    var existingStr = '';
    for (var key in existing) {
      if (existing[key]) {
        existingStr += key + '：' + existing[key] + '\n';
      }
    }

    var prompt = '你是一个小说人物设定的创作助手。当前世界观：' + worldName + '（' + genre + '）。\n';
    if (existingStr) prompt += '\n该人物已有设定：\n' + existingStr;
    prompt += '\n请为角色「' + name + '」补全以下字段：' + fieldsDesc + '\n';
    prompt += '请根据世界观类型和角色身份合理创作。\n';
    prompt += '输出纯 JSON 格式，只包含需要填写的字段，不需要的字段不要输出。示例：\n';
    prompt += '{"personality":"...","bg":"..."}\n';
    prompt += '不要输出任何其他内容，只输出一行合法 JSON。';

    var content = await this._callAPI(prompt, 800, 0.8, 1);
    try {
      // 尝试提取 JSON（可能被 ```json 包裹）
      var jsonStr = content.trim();
      var jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      return JSON.parse(jsonStr);
    } catch(e) {
      console.error('[fillCharacterFields] JSON parse error:', e, 'raw:', content);
      return null;
    }
  },

  // 内置文笔预设（移植自 Python，v4.0 扩充分类）
  STYLE_PRESETS: {
    '十日终焉': '【句子节奏】短句为主，节奏极快。大量使用句号断句，一个动作或一个念想即成一短句。善于用短促的句式制造紧张感。\n【用词偏好】大量使用口语化、弱逻辑连接词。常用反问、内心独白式的自问自答。\n【对话风格】对话极多且节奏极快。说话人的标记极简。\n【描写方式】白描为主，绝不冗长。\n【视角与心理】第三人称有限视角，紧贴主角心理。\n【整体氛围】紧张、压抑、神经质。',

    '夜的命名术': '【句子节奏】长短交替，有韵律感。长句用于画面渲染和氛围营造，短句用于关键信息或情绪爆发。\n【用词偏好】词汇量丰富，喜用诗意的形容词和动词。科幻/赛博词汇自然融入。\n【对话风格】对话幽默机敏，角色之间互动充满智慧和调侃。\n【描写方式】画面感极强，描写有电影的视觉特质。\n【视角与心理】第三人称有限视角，主角内心活动丰富。\n【整体氛围】赛博朋克与浪漫主义交织。',

    '江南': '【句子节奏】长句为主，节奏舒缓从容。善于用绵长的复合句层层铺陈。\n【用词偏好】词汇精美考究，喜用书面语和文学性表达。善用通感和比喻。\n【对话风格】对话量适中，每段精心设计。角色说话讲究分寸和身份。\n【描写方式】描写极其细腻，近乎工笔。环境描写独立且丰满。\n【视角与心理】第三人称全知或有限视角灵活切换。心理描写大量且深入。\n【整体氛围】精致、文艺、带着淡淡的忧郁。',

    '网文热血': '【句子节奏】短句与感叹句交替，节奏明快有力。关键处常用短句爆发情绪，打斗场面节奏极快。\n【用词偏好】词汇直白有力，喜用动词和感官词。常见"轰""砰""刹那"等冲击词。\n【对话风格】对话霸气直接，主角常有"我命由我不由天"式的宣言。反派说话嚣张。\n【描写方式】动作描写为主，招式名称华丽。场面宏大但不拖沓。\n【视角与心理】第三人称有限视角，主角心理活动频繁且直接。\n【整体氛围】热血、爽快、节奏感强。适合升级流、战斗向故事。',

    '古风言情': '【句子节奏】长短句结合，有古典韵律。善用对仗和排比，句子有诗意。\n【用词偏好】词汇典雅，多用古风词汇（"蹙眉""轻叹""执手""阑珊"）。善用诗词化表达。\n【对话风格】对话含蓄优雅，角色说话有身份感。常用敬语和谦辞。\n【描写方式】描写细腻唯美，善用意象（月、花、雨、雪）。外貌描写工笔细致。\n【视角与心理】第三人称有限视角，情感描写细腻含蓄。\n【整体氛围】唯美、缠绵、带古典韵味。适合宫斗、仙侠、古代言情。',

    '悬疑推理': '【句子节奏】短句为主，节奏紧凑。关键线索处会用短句制造悬念，反转处节奏突然加速。\n【用词偏好】词汇精准克制，少用形容词。善用"忽然""然而""可是"等转折词制造意外。\n【对话风格】对话信息量大，每句话都可能是线索。角色说话有保留，话里有话。\n【描写方式】细节描写精准，善用环境细节暗示线索。不过度渲染氛围。\n【视角与心理】第三人称有限视角，主角推理过程详尽。\n【整体氛围】冷峻、理性、充满悬念。适合推理、悬疑、惊悚题材。',

    '都市生活': '【句子节奏】口语化短句为主，节奏贴近日常对话。生活场景描写自然流畅。\n【用词偏好】词汇现代口语化，善用网络用语和流行词。贴近当代生活。\n【对话风格】对话自然真实，有生活气息。角色说话接地气，有个性。\n【描写方式】描写简洁实用，侧重生活细节和人物互动。\n【视角与心理】第三人称有限视角，心理活动真实不做作。\n【整体氛围】轻松、写实、有烟火气。适合都市、职场、生活流题材。',

    '克苏鲁恐怖': '【句子节奏】长句铺陈氛围，短句制造惊悚。节奏由慢到快，恐惧处突然短促。\n【用词偏好】词汇幽暗诡谲，善用"不可名状""亵渎""腐朽"等词。形容词密集且压抑。\n【对话风格】对话颤抖破碎，角色常语无伦次。疯狂者的独白有感染力。\n【描写方式】描写细致且令人不适，善用感官细节（气味、触感、声音）渲染恐惧。\n【视角与心理】第一人称或有限第三人称，主角心理逐渐崩坏。\n【整体氛围】压抑、疯狂、对未知的恐惧。适合恐怖、克苏鲁、末日题材。',

    '直白叙事': '【句子节奏】自然流畅，长短句交替但不刻意。关键信息用清晰直白的句子表达，不故弄玄虚。\n【用词偏好】每天一词，不用生僻词。用"知道"代替"莫名察知"，用"想"代替"心底闪过一个念头"。\n【对话风格】角色有什么说什么，不绕弯子，不打哑谜。可以含蓄但不能晦涩，可以留白但不能让读者完全看不懂。\n【描写方式】信息优先：每一段描写要么推进剧情、要么揭示人物、要么营造氛围，三者必占其一。不写"纯意境"段落。\n【视角与心理】主角的心理活动直接呈现："他想..."、"他决定..."。不用省略号或留白代替关键判断。\n【整体氛围】清晰、可读、不故弄玄虚。让读者知道角色在想什么、为什么这么做。适合所有题材的基础叙事。',
  },

  loadStylePreset(name) {
    const style = this.STYLE_PRESETS[name];
    if (style) { this._styleMemory = style; return style; }
    return null;
  },

  listStylePresets() {
    return Object.keys(this.STYLE_PRESETS);
  },

  // === 设定导入 ===
  async importSettings(text) {
    const prompt = '从以下文本中提取世界观设定。输出纯JSON：{"genre":"","world_name":"","world_desc":"","era":"","locations":"","factions":"","power_system":"","characters":[{"name":"","role":"","personality":"","background":""}]}。\n\n文本：\n' + text.slice(0, 5000);
    const content = await this._callAPI(prompt, 1500, 0.7, 2);
    return this._safeJsonParse(content, 'import-settings');
  },

  // === 影视/文学提取设定 ===
  async extractMedia(query, mediaType) {
    const prompt = '请根据你的知识，提取' + (mediaType || '作品') + '《' + query + '》的世界观设定。输出纯JSON：{"world_name":"","world_desc":"","era":"","locations":"","factions":"","power_system":""}。';
    const content = await this._callAPI(prompt, 800, 0.7, 1);
    return this._safeJsonParse(content, 'extract-media');
  },

  async listSubWorks(query) {
    const prompt = '列出' + query + '相关的子系列/衍生作品。输出纯JSON：{"items":[{"name":"","desc":""}]}。';
    const content = await this._callAPI(prompt, 400, 0.7, 1);
    return this._safeJsonParse(content, 'list-sub-works');
  },

  // === 人物关系生成 ===
  async generateCharacterRelations(keyword) {
    const system = '你是小说角色关系设计师。根据用户提供的关键词，生成5-8个人物及其关系。\n返回严格JSON（只返回JSON，不要任何其他文字）：\n{"characters":[{"name":"","role":"","description":"","traits":[],"appearance":"","background":""}],\n "relationships":[{"from":"角色名1","to":"角色名2","type":"师徒|恋人|亲人|朋友|仇敌|同门|同盟|暗恋|利用|敌对|主仆","description":""}]}\n关系类型从以下选：师徒、恋人、亲人、朋友、仇敌、同门、同盟、暗恋、利用、敌对、主仆、自定义。';
    const prompt = keyword;
    const content = await this._callAPI(system + '\n\n用户关键词：' + prompt, 1200, 0.8, 1, 60000);
    return this._safeJsonParse(content, 'character-relations');
  },

  /** AI补全空字段：根据已有信息填充空缺 */
  async autoComplete(fieldType, existing, genre) {
    let system = '';
    if (fieldType === 'character') {
      system = `你是小说角色设计师。根据已有的角色信息和世界观，补全缺失的字段。
已有信息：姓名="${existing.name||'未定'}"，身份="${existing.role||'未知'}"，特质="${(existing.traits||[]).join('、')||'未填'}"，外貌="${existing.appearance||'未填'}"，背景="${existing.background||'未填'}"，功法="${existing.abilities||'未填'}"，境界="${existing.level||'未填'}"。
题材：${genre||'未指定'}。
请返回JSON，只包含缺失或可以优化的字段：{"appearance":"...","background":"...","abilities":"...","level":"..."}。不要重复已有内容，只补充空白的。`;
    } else if (fieldType === 'ability') {
      system = `你是功法/能力设计师。为以下功法补充详细信息。
功法名="${existing.name||'未定'}"，类型="${existing.type||'未知'}"，已有描述="${existing.description||'未填'}"。
题材：${genre||'未指定'}。
返回JSON：{"description":"...","effects":"...","requirements":"..."}。只补充空白的。`;
    } else if (fieldType === 'location') {
      system = `你是世界观地点设计师。为以下地点补充详细信息。
地点名="${existing.name||'未定'}"，类型="${existing.type||'未知'}"，已有描述="${existing.description||'未填'}"。
题材：${genre||'未指定'}。
返回JSON：{"description":"...","significance":"...","atmosphere":"..."}。只补充空白的。`;
    }
    const content = await this._callAPI(system, 600, 0.8, 1);
    return this._safeJsonParse(content, 'autocomplete');
  },
};
console.log('[ai-bridge] AIBridge loaded, typeof testConfig:', typeof AIBridge.testConfig);

// 自动初始化
AIBridge.init();
// ── 确保 AIBridge 在 onclick 中可访问（const 不挂 window）──
window.AIBridge = AIBridge;


