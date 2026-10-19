@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Cai dat BDS Video Studio
echo ============================================================
echo   CAI DAT BDS VIDEO STUDIO (de Claude dung video tren may nay)
echo   Lan dau mat khoang 15-30 phut tuy toc do mang. Cu de chay.
echo ============================================================
echo.

rem --- 0) winget (co san tren Windows 10/11 cap nhat) ---
where winget >nul 2>nul
if errorlevel 1 (
  echo [LOI] May chua co "winget" ^(App Installer^). Mo Microsoft Store, cai "App Installer" roi chay lai file nay.
  pause & exit /b 1
)

rem them san duong dan cac chuong trinh se cai (de dung ngay, khong can mo lai cua so)
set "PATH=%PATH%;%ProgramFiles%\Git\cmd;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%LOCALAPPDATA%\Microsoft\WinGet\Links"
set WG=winget install -e --silent --accept-source-agreements --accept-package-agreements

echo === 1/7 Git ===
where git >nul 2>nul || %WG% --id Git.Git
echo === 2/7 Node.js ===
where node >nul 2>nul || %WG% --id OpenJS.NodeJS.LTS
echo === 3/7 Python 3.12 ===
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if exist "F:\Tools\Python312\python.exe" set "PY=F:\Tools\Python312\python.exe"
if not exist "%PY%" %WG% --id Python.Python.3.12 --scope user
echo === 4/7 ffmpeg ===
where ffmpeg >nul 2>nul || %WG% --id Gyan.FFmpeg

for %%T in (git node ffmpeg) do (
  where %%T >nul 2>nul || (
    echo [LOI] Chua tim thay "%%T" sau khi cai. Dong cua so nay, mo lai file CAI-DAT.bat ^(Windows can mo lai de nhan chuong trinh moi^).
    pause & exit /b 1
  )
)
if not exist "%PY%" (
  echo [LOI] Chua thay Python 3.12 o "%PY%". Dong cua so, chay lai file nay.
  pause & exit /b 1
)

echo === 5/7 Lay ma nguon tu GitHub ===
rem Dang dat file nay trong thu muc ma nguon (co package.json) thi dung luon thu muc do
if exist "%~dp0package.json" (
  set "APP=%~dp0"
  set "APP=!APP:~0,-1!"
) else (
  set "APP=%USERPROFILE%\BDSVideoStudio\app"
  if not exist "!APP!\package.json" (
    echo Lan dau: Git se mo trinh duyet de dang nhap GitHub ^(tai khoan da duoc cap quyen doc repo^).
    git clone --single-branch --branch feat/chu-nhan https://github.com/longnhatcontact-source/autoeditvideo "!APP!"
    if errorlevel 1 (
      echo [LOI] Khong tai duoc ma nguon. Kiem tra: tai khoan GitHub da duoc anh Nhat cap quyen chua?
      pause & exit /b 1
    )
  )
)
cd /d "%APP%"
git pull --ff-only

echo === 6/7 Cai thu vien ^(npm + faster-whisper^) ===
call npm install --no-audit --no-fund
if errorlevel 1 ( echo [LOI] npm install loi. Chup man hinh gui Claude. & pause & exit /b 1 )
rem loi da gap: thieu esbuild.exe -> dung hinh bao "Host version ... does not match binary version"
if not exist "node_modules\@esbuild\win32-x64\esbuild.exe" (
  echo Sua thu vien esbuild...
  for /f %%v in ('node -p "require('esbuild/package.json').version"') do set ESV=%%v
  call npm install --no-save --no-audit --no-fund @esbuild/win32-x64@!ESV!
)
if not exist "node_modules\electron\dist\electron.exe" node node_modules\electron\install.js
"%PY%" -m pip install --upgrade --quiet faster-whisper
if errorlevel 1 ( echo [LOI] Khong cai duoc faster-whisper. Chup man hinh gui Claude. & pause & exit /b 1 )

echo === 7/7 Tai model nhan giong noi ^(1,5GB, chi lan dau^) ===
"%PY%" -c "import sys; sys.path.insert(0, r'%APP%\scripts'); import transcribe as t; from faster_whisper import WhisperModel; WhisperModel('medium', device='cpu', compute_type='int8', download_root=t.CACHE_DIR); print('Model OK:', t.CACHE_DIR)"
if errorlevel 1 echo [CANH BAO] Chua tai duoc model. Lan nhan giong dau tien app se thu tai lai.

rem loi tat ra man hinh: mo app bang MO-APP.bat
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\BDS Video Studio (Claude).lnk'); $s.TargetPath='%APP%\MO-APP.bat'; $s.WorkingDirectory='%APP%'; $s.IconLocation='%APP%\app\icon.ico'; $s.Save()"

echo.
echo ============================================================
echo   XONG. Thu muc app: %APP%
echo   - Mo app: bam dup bieu tuong "BDS Video Studio (Claude)" ngoai man hinh.
echo     Cua so den phai DE MO trong luc Claude dung video.
echo   - Trong app Claude tren may tinh: lien ket phien voi may nay,
echo     cap quyen thu muc tren va thu muc Downloads.
echo ============================================================
pause
