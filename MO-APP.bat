@echo off
title BDS Video Studio
cd /d "%~dp0"

if not exist "package.json" (
  echo [LOI] File nay phai nam trong thu muc app BDS Video Studio ^(thu muc co file package.json^).
  echo Hay copy file MO-APP.bat vao dung thu muc do roi bam dup lai.
  pause
  exit /b 1
)

echo === 1/4 Lay ban moi nhat tu GitHub ===
git fetch origin
git checkout feat/chu-nhan
if errorlevel 1 (
  echo [LOI] Khong chuyen sang ban moi duoc. Chup man hinh nay gui Claude.
  pause
  exit /b 1
)
git pull --ff-only

echo === 2/4 Cai thu vien ^(lan dau hoi lau^) ===
call npm install
if errorlevel 1 (
  echo [LOI] npm install bi loi. Chup man hinh nay gui Claude.
  pause
  exit /b 1
)

echo === 3/4 Kiem tra Electron ===
if not exist "node_modules\electron\dist\electron.exe" node node_modules\electron\install.js

echo === 4/4 Mo app ^(che do tu cap nhat^) ===
echo Cua so den nay phai de mo. Tat app = dong cua so app hoac bam Ctrl+C o day.
call npm run dev:sync
pause
