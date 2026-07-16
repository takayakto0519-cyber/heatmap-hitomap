# ヒトマップ アフィリエイト自動実行 — タスクスケジューラ登録
# 実行: powershell -ExecutionPolicy Bypass -File register_scheduler.ps1

$taskName   = "HitomapAffiliate"
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$pythonExe  = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $pythonExe) {
    Write-Host "ERROR: python が見つかりません" -ForegroundColor Red
    exit 1
}

$mainPy  = Join-Path $scriptDir "main.py"
$logFile = Join-Path $scriptDir "logs\scheduler.log"

# 既存タスクがあれば削除
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "既存タスクを削除しました"
}

# アクション定義
$action  = New-ScheduledTaskAction `
    -Execute $pythonExe `
    -Argument "`"$mainPy`"" `
    -WorkingDirectory $scriptDir

# トリガー: 毎日 07:00
$trigger = New-ScheduledTaskTrigger -Daily -At "07:00"

# 設定
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

# 現在のユーザーで登録（管理者権限不要）
Register-ScheduledTask `
    -TaskName   $taskName `
    -Action     $action `
    -Trigger    $trigger `
    -Settings   $settings `
    -RunLevel   Limited `
    -Force | Out-Null

Write-Host ""
Write-Host "✅ タスクスケジューラ登録完了" -ForegroundColor Green
Write-Host "   タスク名: $taskName"
Write-Host "   実行時刻: 毎日 07:00"
Write-Host "   実行ファイル: $mainPy"
Write-Host ""
Write-Host "確認: Get-ScheduledTask -TaskName '$taskName'"
Write-Host "手動実行: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "削除: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
