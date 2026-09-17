// ============================
// THEME MANAGER
// ============================
var ThemeManager = {
  currentTheme: 'night',

  themes: {
    // 墨夜（海报风格 · 纯黑鎏金）
    night: {
      name: '墨夜',
      icon: '',
      vars: {
        '--bg': '#070705', '--panel': '#0a0a08', '--card': '#0f0f0d', '--card-hover': '#161614',
        '--border': '#1a1a18', '--border-light': 'rgba(201,168,76,.08)',
        '--gold': '#c9a84c', '--gold-light': '#e2c97e', '--gold-pale': '#f0d88a', '--gold-dark': '#8b6914',
        '--gold-dim': 'rgba(201,168,76,.3)',
        '--text': '#b8b0a0', '--text-dim': '#585852', '--text-bright': '#e0d8c8',
        '--accent': '#c9a84c', '--accent-glow': 'rgba(201,168,76,.2)',
        '--danger': '#d05555', '--success': '#4caf7c', '--hp': '#4caf7c',
        '--mp': '#c9a84c', '--sp': '#c9a84c', '--exp': '#a880c8',
        '--ai-color': '#6ae0b0',
        '--overlay-bg': 'rgba(7,7,5,0.92)',
        '--menu-bg': 'radial-gradient(ellipse at center, #0c0c0a 0%, #070705 100%)',
        '--menu-glow': 'rgba(201,168,76,.12)',
        '--btn-primary-from': '#140e02', '--btn-primary-to': '#261a06', '--btn-primary-hover': '#382a10',
        '--input-bg': '#090908', '--code-bg': '#070707',
        '--title-grad-from': '#ffeec0', '--title-grad-to': '#8b6914',
      },
      swatch: '#070705',
    },

    // 白昼（暖白鎏金）
    day: {
      name: '白昼',
      icon: '',
      vars: {
        '--bg': '#f8f6f2', '--panel': '#ffffff', '--card': '#faf8f5', '--card-hover': '#f0ece6',
        '--border': '#d8d4ce', '--border-light': 'rgba(201,168,76,.12)',
        '--gold': '#b8860b', '--gold-light': '#d4a017', '--gold-pale': '#e8c040', '--gold-dark': '#8b6914',
        '--gold-dim': 'rgba(184,134,11,.25)',
        '--text': '#2c2822', '--text-dim': '#8a8680', '--text-bright': '#1a1610',
        '--accent': '#b8860b', '--accent-glow': 'rgba(184,134,11,.2)',
        '--danger': '#c0392b', '--success': '#27ae60', '--hp': '#27ae60',
        '--mp': '#b8860b', '--sp': '#b8860b', '--exp': '#8e44ad',
        '--ai-color': '#1a8f6e',
        '--overlay-bg': 'rgba(248,246,242,0.92)',
        '--menu-bg': 'linear-gradient(135deg, #faf8f5 0%, #f0ece6 50%, #e8e2d8 100%)',
        '--menu-glow': 'rgba(184,134,11,.12)',
        '--btn-primary-from': '#d4c8b0', '--btn-primary-to': '#c8b8a0', '--btn-primary-hover': '#b8a88c',
        '--input-bg': '#ffffff', '--code-bg': '#f0ece6',
        '--title-grad-from': '#d4a017', '--title-grad-to': '#8b6914',
      },
      swatch: '#faf8f5',
    },

    // 原木（暖木金纹）
    wood: {
      name: '原木',
      icon: '',
      vars: {
        '--bg': '#e8ddd0', '--panel': '#d4c5b0', '--card': '#cbb89e', '--card-hover': '#c0ac90',
        '--border': '#a89478', '--border-light': 'rgba(139,105,20,.1)',
        '--gold': '#8b6914', '--gold-light': '#a68020', '--gold-pale': '#c8a040', '--gold-dark': '#6a5010',
        '--gold-dim': 'rgba(139,105,20,.25)',
        '--text': '#3d2e1a', '--text-dim': '#7a6b58', '--text-bright': '#2a1f10',
        '--accent': '#8b6914', '--accent-glow': 'rgba(139,105,20,.2)',
        '--danger': '#a04030', '--success': '#5a7a4a', '--hp': '#5a7a4a',
        '--mp': '#8b6914', '--sp': '#8b6914', '--exp': '#7a5a8a',
        '--ai-color': '#3a6a4a',
        '--overlay-bg': 'rgba(200,180,160,0.92)',
        '--menu-bg': 'linear-gradient(135deg, #d4c5b0 0%, #c8b8a0 50%, #b8a88c 100%)',
        '--menu-glow': 'rgba(139,105,20,.15)',
        '--btn-primary-from': '#8a7a60', '--btn-primary-to': '#7a6a50', '--btn-primary-hover': '#6a5a40',
        '--input-bg': '#f0e8dc', '--code-bg': '#c8b8a0',
        '--title-grad-from': '#a68020', '--title-grad-to': '#8b6914',
      },
      swatch: '#cbb89e',
    },

    // 墨青（深色青金）
    jade: {
      name: '墨青',
      icon: '',
      vars: {
        '--bg': '#0a0e0c', '--panel': '#0e1210', '--card': '#121816', '--card-hover': '#181e1c',
        '--border': '#18221e', '--border-light': 'rgba(201,168,76,.06)',
        '--gold': '#c9a84c', '--gold-light': '#e2c97e', '--gold-pale': '#f0d88a', '--gold-dark': '#8b6914',
        '--gold-dim': 'rgba(201,168,76,.2)',
        '--text': '#b0b8b0', '--text-dim': '#5a6860', '--text-bright': '#d8e0d8',
        '--accent': '#c9a84c', '--accent-glow': 'rgba(201,168,76,.15)',
        '--danger': '#d06040', '--success': '#3a9a5a', '--hp': '#3a9a5a',
        '--mp': '#c9a84c', '--sp': '#c9a84c', '--exp': '#8a6aaa',
        '--ai-color': '#2ea080',
        '--overlay-bg': 'rgba(10,14,12,0.92)',
        '--menu-bg': 'radial-gradient(ellipse at center, #0e1210 0%, #070a08 100%)',
        '--menu-glow': 'rgba(201,168,76,.1)',
        '--btn-primary-from': '#0a1a10', '--btn-primary-to': '#0e2a18', '--btn-primary-hover': '#1a4030',
        '--input-bg': '#0a0e0c', '--code-bg': '#070a08',
        '--title-grad-from': '#c8d8c0', '--title-grad-to': '#8b6914',
      },
      swatch: '#0e1210',
    },
  },

  init() {
    const saved = localStorage.getItem('if-theme');
    if (saved && this.themes[saved]) {
      this.apply(saved);
    } else {
      this.apply('night');
    }
  },

  apply(themeId) {
    const theme = this.themes[themeId];
    if (!theme) return;
    this.currentTheme = themeId;

    // Apply all CSS variables to :root
    const root = document.documentElement;
    for (const [key, val] of Object.entries(theme.vars)) {
      root.style.setProperty(key, val);
    }

    // Update theme swatch active state
    document.querySelectorAll('.theme-swatch').forEach(el => {
      el.classList.toggle('active', el.dataset.theme === themeId);
    });

    // Update topbar theme button text
    const btn = document.getElementById('topbar-theme-btn');
    if (btn) {
      btn.textContent = theme.name;
    }

    localStorage.setItem('if-theme', themeId);
  },

  cycle() {
    const ids = Object.keys(this.themes);
    const idx = ids.indexOf(this.currentTheme);
    const next = ids[(idx + 1) % ids.length];
    this.apply(next);
  },

  /** Build theme selector HTML for the main menu */
  renderSwatches() {
    const ids = Object.keys(this.themes);
    return ids.map(id => {
      const t = this.themes[id];
      const active = id === this.currentTheme ? ' active' : '';
      return `<button class="theme-swatch${active}" data-theme="${id}" title="${t.name}" onclick="ThemeManager.apply('${id}')" style="background:${t.swatch};border-color:${t.vars['--border']};">
        <span class="ts-tip">${t.name}</span>
      </button>`;
    }).join('');
  },
};
// ── 确保 ThemeManager 在 onclick 中可访问（const 不挂 window）──
window.ThemeManager = ThemeManager;
