# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:\\Users\\imda0\\Desktop\\커서 ai 폴더\\naver-trend-maker-10\\local_app_launcher.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\imda0\\Desktop\\커서 ai 폴더\\naver-trend-maker-10\\web\\.next-prod', 'site')],
    hiddenimports=[],
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
    a.binaries,
    a.datas,
    [],
    name='Naver Trend Maker 10 로컬버전',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
