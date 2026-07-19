# Register read-only local agents + revisit_prompt(notifications書き込みのみ・外部送信なし) to Windows Task Scheduler.
$dir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = (Get-Command python -ErrorAction SilentlyContinue).Source

if (-not $python) {
    Write-Host "Error: Python not found." -ForegroundColor Red
    exit 1
}

function Register-Agent($taskName, $script, $time) {
    $action   = New-ScheduledTaskAction -Execute $python -Argument "`"$dir\$script`"" -WorkingDirectory $dir
    $trigger  = New-ScheduledTaskTrigger -Daily -At $time
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RestartCount 1 -StartWhenAvailable
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    Write-Host "Registered: $taskName (daily at $time)" -ForegroundColor Green
}

function Register-RepeatingAgent($taskName, $script, $startTime, $intervalHours) {
    $action   = New-ScheduledTaskAction -Execute $python -Argument "`"$dir\$script`"" -WorkingDirectory $dir
    $trigger  = New-ScheduledTaskTrigger -Once -At $startTime `
                  -RepetitionInterval (New-TimeSpan -Hours $intervalHours) `
                  -RepetitionDuration (New-TimeSpan -Days 3650)
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RestartCount 1 -StartWhenAvailable
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    Write-Host "Registered: $taskName (every $intervalHours h, starting $startTime)" -ForegroundColor Green
}

Register-Agent "HitomapApprovalWatch" "approval_watch.py" "08:00"
Register-Agent "HitomapReportScreen"  "report_screen.py"  "07:30"
Register-Agent "HitomapTraceQA"       "trace_qa.py"        "02:00"
Register-Agent "HitomapDeadlineWatch" "deadline_watch.py"  "07:00"
Register-Agent "HitomapSpamDetect"    "spam_detect.py"     "03:00"
Register-RepeatingAgent "HitomapNewsDigest" "news_digest.py" "06:30" 8
Register-Agent "HitomapFinancialSnapshot" "financial_snapshot.py" "07:45"
Register-Agent "HitomapRevisitPrompt" "revisit_prompt.py" "09:00"
Register-Agent "HitomapCasePipelineWatch" "case_pipeline_watch.py" "08:15"
Register-Agent "HitomapRevenueInitiativeWatch" "revenue_initiative_watch.py" "08:30"
Register-Agent "HitomapOfficeDiary" "office_diary.py" "09:15"
Register-Agent "HitomapLeadTemperature" "lead_temperature.py" "08:45"
Register-Agent "HitomapPaymentWatch" "payment_watch.py" "08:50"
Register-Agent "HitomapLostDealArchive" "lost_deal_archive.py" "09:05"
Register-Agent "HitomapScheduleWatch" "schedule_watch.py" "07:15"
Register-Agent "HitomapBurnoutWatch" "burnout_watch.py" "21:00"
Register-Agent "HitomapLineMission" "line_mission.py" "10:00"
Register-Agent "HitomapEmailQueue" "email_queue.py" "08:35"
Register-Agent "HitomapTracePattern" "trace_pattern.py" "02:30"
Register-Agent "HitomapRelationPopulation" "relation_population.py" "02:40"
Register-Agent "HitomapCalendarWatch" "calendar_watch.py" "06:50"

Write-Host ""
Write-Host "Manual test example:" -ForegroundColor Cyan
Write-Host "  cd `"$dir`"; python approval_watch.py"
