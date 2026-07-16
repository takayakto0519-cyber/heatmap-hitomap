@echo off
cd /d "%~dp0"
echo [%date% %time%] 自動投稿システム起動 >> logs\system.log
python main.py >> logs\system.log 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: main.py 失敗 >> logs\system.log
)
