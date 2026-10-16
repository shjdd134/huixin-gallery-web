@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22.18+ 或 24+，再重新打开此文件。
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm ci
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)
node -e "const fs=require('node:fs'),path=require('node:path');const entry='dist/index.html';if(!fs.existsSync(entry))process.exit(10);const built=fs.statSync(entry).mtimeMs;const inputs=['src','public','index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json'];function newer(file){if(!fs.existsSync(file))return false;const stat=fs.statSync(file);if(stat.mtimeMs>built)return true;return stat.isDirectory()&&fs.readdirSync(file).some(name=>newer(path.join(file,name)));}process.exit(inputs.some(newer)?10:0);"
if errorlevel 11 goto build_check_failed
if errorlevel 10 goto rebuild
if errorlevel 1 goto build_check_failed
goto start_preview

:rebuild
echo 源码或素材有更新，正在准备新版会心馆。
call npm run build
if errorlevel 1 (
  echo 构建失败，请保留错误信息。
  pause
  exit /b 1
)

:start_preview
echo 会心馆将在 http://127.0.0.1:4173/ 打开。
echo 保持此窗口运行。关闭窗口会停止本机服务器。
start "" "http://127.0.0.1:4173/"
call npm run preview
pause
exit /b

:build_check_failed
echo 无法检查构建版本，请保留错误信息。
pause
exit /b 1
