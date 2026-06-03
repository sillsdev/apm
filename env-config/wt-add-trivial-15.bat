@echo off
setlocal
REM 15 worktrees for trivial.md PR plan — calls wt-add.bat per branch (nocursor for batch).
cd /d "%~dp0"

set "BRANCHES=TT-7343-pending-uploads TT-7375-mark-verse-save TT-6473-spell-check TT-6942-record-tooltips TT-7101-mobile-pbt TT-7210-record-step TT-6577-notes-unsaved TT-6670-publishing-rows TT-internalize-fixes TT-7354-racetrack-mobile TT-7373-discussion-layout TT-6646-community-metadata TT-7359-bold-download TT-5244-ready-to-sync TT-5103-offline-export"

for %%B in (%BRANCHES%) do (
  echo.
  echo ===== %%B =====
  call "%~dp0wt-add.bat" %%B nocursor
  if errorlevel 1 (
    echo FAILED: wt-add.bat %%B
    exit /b 1
  )
)

echo.
echo All 15 worktrees ready under git\wt\
cd /d "%~dp0.."
git worktree list
endlocal
