# Windowsタスクスケジューラに毎朝7時の自動実行を登録
$taskName = "HitomapAffiliate"
$dir      = Split-Path -Parent $MyInvocation.MyCommand.Path
$python   = (Get-Command python -ErrorAction SilentlyContinue).Source

if (-not $python) {
    Write-Host "エラー: Pythonが見つかりません。Pythonをインストールしてから再実行してください。" -ForegroundColor Red
    exit 1
}

$action   = New-ScheduledTaskAction -Execute $python -Argument "`"$dir\main.py`"" -WorkingDirectory $dir
$trigger  = New-ScheduledTaskTrigger -Daily -At "07:00"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -RestartCount 1 -StartWhenAvailable $true

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force

Write-Host ""
Write-Host "タスク登録完了: 毎朝 7:00 に自動実行" -ForegroundColor Green
Write-Host "タスク名: $taskName"
Write-Host "確認: タスクスケジューラ を開いて '$taskName' を探してください"
Write-Host ""
Write-Host "手動テスト実行:"
Write-Host "  cd `"$dir`""
Write-Host "  python main.py"
