@echo off
setlocal
REM Always run from repo root so worktrees land in ..\wt\ (sibling of apm-vite).
set "REPO=%~dp0.."
cd /d "%REPO%"
if exist "..\wt\%1" (
  echo Worktree %1 already exists at ..\wt\%1, skipping add.
) else if exist "wt\%1" (
  echo Moving worktree from wt\%1 to ..\wt\%1 ...
  git worktree move "wt\%1" "..\wt\%1"
  if errorlevel 1 exit /b 1
) else (
  git worktree add "..\wt\%1" -b %1
  if errorlevel 1 exit /b 1
)
cd "..\wt\%1"
call npm install
if errorlevel 1 exit /b 1
cd src\renderer
call npm install
if errorlevel 1 exit /b 1
cd ..\..
call npm run stamp
if errorlevel 1 exit /b 1
if not exist env-config mkdir env-config
xcopy /Y /Q "%REPO%\env-config\*" "env-config\" >nul
xcopy /Y /H /Q "%REPO%\env-config\.env*" "env-config\" >nul
call npm run devs
if errorlevel 1 exit /b 1
if exist "%REPO%\localization\bin" (
  xcopy "%REPO%\localization\bin" "localization\bin\" /E /I /Y /Q
) else (
  echo WARNING: %REPO%\localization\bin not found, skipping.
)
if /I not "%2"=="nocursor" cursor .
endlocal
