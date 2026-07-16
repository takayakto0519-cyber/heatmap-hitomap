@echo off
chcp 65001 > nul
echo ============================================
echo  ヒトマップ アフィリエイト自動投稿セットアップ
echo ============================================
echo.

echo [1/3] Pythonライブラリをインストール中...
pip install -r "%~dp0requirements.txt"
if %errorlevel% neq 0 (
    echo エラー: pip install 失敗
    pause
    exit /b 1
)

echo.
echo [2/3] Playwright ブラウザをインストール中（Chromium）...
playwright install chromium
if %errorlevel% neq 0 (
    echo 警告: Playwright インストール失敗（note投稿が手動になります）
)

echo.
echo [3/3] ログ・キャッシュ・下書きフォルダ作成中...
if not exist "%~dp0logs"   mkdir "%~dp0logs"
if not exist "%~dp0cache"  mkdir "%~dp0cache"
if not exist "%~dp0drafts" mkdir "%~dp0drafts"

echo.
echo ============================================
echo  セットアップ完了！
echo.
echo  次のステップ:
echo  1. affiliate-auto\.env を編集して NOTE_PASSWORD を設定
echo  2. register_task.ps1 を右クリック → PowerShellで実行
echo     （毎朝7時に自動実行を登録します）
echo ============================================
pause
