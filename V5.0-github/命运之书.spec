# -*- mode: python ; coding: utf-8 -*-
# 命运之书 v4.2 — 精简打包配置

a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('interactive-fiction.html', '.'),
        ('world-builder.html', '.'),
        ('config.json', '.'),
        ('manifest.json', '.'),
        ('js', 'js'),
    ],
    hiddenimports=['jinja2.ext', 'flask', 'flask_cors', 'requests', 'urllib3', 'certifi', 'charset_normalizer', 'idna'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='命运之书',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='命运之书',
)
