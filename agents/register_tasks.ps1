# Register read-only local agents + revisit_prompt(notifications書き込みのみ・外部送信なし) to Windows Task Scheduler.
$dir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = (Get-Command python -ErrorAction SilentlyContinue).Source

if (-not $python) {
    Write-Host "Error: Python not found." -ForegroundColor Red
    exit 1
}

function Register-Agent($taskName, $script, $time, $timeoutMinutes = 10) {
    $action   = New-ScheduledTaskAction -Execute $python -Argument "`"$dir\$script`"" -WorkingDirectory $dir
    $trigger  = New-ScheduledTaskTrigger -Daily -At $time
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes $timeoutMinutes) -RestartCount 1 -StartWhenAvailable
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    Write-Host "Registered: $taskName (daily at $time, timeout ${timeoutMinutes}m)" -ForegroundColor Green
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

function Register-WeeklyAgent($taskName, $script, $dayOfWeek, $time) {
    $action   = New-ScheduledTaskAction -Execute $python -Argument "`"$dir\$script`"" -WorkingDirectory $dir
    $trigger  = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $dayOfWeek -At $time
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RestartCount 1 -StartWhenAvailable
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    Write-Host "Registered: $taskName (weekly $dayOfWeek at $time)" -ForegroundColor Green
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
Register-Agent "HitomapActionItemsDigest" "action_items_digest.py" "08:20"
Register-Agent "HitomapRosterHealthWatch" "roster_health_watch.py" "09:35"
Register-Agent "HitomapRevenueInitiativeWatch" "revenue_initiative_watch.py" "08:30"
Register-Agent "HitomapOfficeDiary" "office_diary.py" "09:15"
Register-Agent "HitomapLeadTemperature" "lead_temperature.py" "08:45"
Register-Agent "HitomapFactCheckWatch" "fact_check_watch.py" "08:10"
Register-Agent "HitomapProposalQueueWatch" "proposal_queue_watch.py" "08:25"
Register-Agent "HitomapAutopilot" "autopilot.py" "09:20" 90  # deep-research込みのkind(validation_research等)は10分を超えることがあるため長めに確保
Register-Agent "HitomapProcurementWatch" "procurement_watch.py" "06:05"
Register-Agent "HitomapPaymentWatch" "payment_watch.py" "08:50"
Register-Agent "HitomapLostDealArchive" "lost_deal_archive.py" "09:05"
Register-Agent "HitomapScheduleWatch" "schedule_watch.py" "07:15"
Register-Agent "HitomapLineMission" "line_mission.py" "10:00"
Register-Agent "HitomapEmailQueue" "email_queue.py" "08:35"
Register-Agent "HitomapTracePattern" "trace_pattern.py" "02:30"
Register-Agent "HitomapRelationPopulation" "relation_population.py" "02:40"
Register-Agent "HitomapCalendarWatch" "calendar_watch.py" "06:50"
Register-Agent "HitomapGmailWatch" "gmail_watch.py" "07:10"
Register-Agent "HitomapCompetitorMarketResearch" "competitor_market_research.py" "06:00"
Register-Agent "HitomapMarketingDigest" "marketing_digest.py" "08:40"
Register-Agent "HitomapCompetitorFeatureMonitor" "competitor_feature_monitor.py" "06:10"
Register-Agent "HitomapAbTestSummaryWatch" "ab_test_summary_watch.py" "03:10"
Register-Agent "HitomapCommandCenter" "command_center.py" "09:30"
Register-Agent "HitomapNewBizSignalWatch" "new_biz_signal_watch.py" "05:40"
Register-Agent "HitomapGlobalMarketWatch" "global_market_watch.py" "06:20"
Register-Agent "HitomapAcademicPartnershipWatch" "academic_partnership_watch.py" "06:30"
Register-Agent "HitomapMemorialAnniversaryWatch" "memorial_anniversary_watch.py" "07:05"
Register-RepeatingAgent "HitomapSyncStatusToSupabase" "sync_status_to_supabase.py" "02:15" 1
Register-Agent "HitomapShachoMemoDaily" "shacho_memo_daily.py" "09:40"
Register-WeeklyAgent "HitomapShachoKeieikaigiWeekly" "shacho_keiei_kaigi_weekly.py" "Monday" "09:45"

Write-Host ""
Write-Host "Manual test example:" -ForegroundColor Cyan
Write-Host "  cd `"$dir`"; python approval_watch.py"
