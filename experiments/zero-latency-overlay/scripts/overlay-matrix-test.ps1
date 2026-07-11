param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$OutputRoot = "",
    [int]$WarmupSeconds = 2,
    [int]$DurationSeconds = 10,
    [int]$ScrollEvents = 10,
    [int]$MinSamples = 2,
    [int]$MaxExtraSampleWaitSeconds = 12,
    [double]$MaxVisibleJitter = 7.0,
    [double]$MaxSemanticJitter = 6.0,
    [switch]$DisableJitterGate,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $RepoRoot "test-results\overlay-matrix"
}

function Write-Info([string]$Message) {
    Write-Host "[overlay-matrix] $Message"
}

function Ensure-Directory([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function New-RunDirectory([string]$Root) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $dir = Join-Path $Root $stamp
    Ensure-Directory $Root
    Ensure-Directory $dir
    return $dir
}

function Resolve-BrowserPath {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe")
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Ensure-OverlayBinary([string]$RepoRootPath) {
    $exePath = Join-Path $RepoRootPath "target\debug\overlay-daemon.exe"
    if (Test-Path -LiteralPath $exePath) {
        return $exePath
    }

    Write-Info "overlay-daemon binary not found, building..."
    Push-Location $RepoRootPath
    try {
        & cargo build --bin overlay-daemon
        if ($LASTEXITCODE -ne 0) {
            throw "cargo build failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $exePath)) {
        throw "overlay-daemon binary still missing after build: $exePath"
    }

    return $exePath
}

function Start-OverlayDaemon([string]$OverlayExe, [string]$WorkingDir, [string]$StdoutPath, [string]$StderrPath) {
    return Start-Process `
        -FilePath $OverlayExe `
        -WorkingDirectory $WorkingDir `
        -RedirectStandardOutput $StdoutPath `
        -RedirectStandardError $StderrPath `
        -PassThru
}

function Stop-ProcessSafe($Process) {
    if ($null -eq $Process) {
        return
    }
    try {
        if (-not $Process.HasExited) {
            Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        }
    }
    catch {
        # Ignore shutdown race conditions.
    }
}

function Wait-ForOverlayStartup([string]$StdoutPath, [string]$StderrPath, [int]$TimeoutSeconds = 15) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $all = @()
        if (Test-Path -LiteralPath $StdoutPath) { $all += Get-Content -Path $StdoutPath -ErrorAction SilentlyContinue }
        if (Test-Path -LiteralPath $StderrPath) { $all += Get-Content -Path $StderrPath -ErrorAction SilentlyContinue }
        if ($all -match "overlay-daemon starting") {
            return $true
        }
        Start-Sleep -Milliseconds 250
    }
    return $false
}

function Get-LogLines([string]$StdoutPath, [string]$StderrPath) {
    $lines = @()
    if (Test-Path -LiteralPath $StdoutPath) {
        $lines += Get-Content -Path $StdoutPath -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $StderrPath) {
        $lines += Get-Content -Path $StderrPath -ErrorAction SilentlyContinue
    }
    return $lines
}

function Parse-UtcTimestamp([string]$Text) {
    return [DateTime]::Parse(
        $Text,
        [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
    )
}

function Get-StdDev([double[]]$Values) {
    if ($null -eq $Values -or $Values.Count -le 1) {
        return 0.0
    }

    $avg = ($Values | Measure-Object -Average).Average
    $sumSquares = 0.0
    foreach ($value in $Values) {
        $delta = $value - $avg
        $sumSquares += ($delta * $delta)
    }

    $variance = $sumSquares / $Values.Count
    return [Math]::Sqrt($variance)
}

function Get-MetricsForWindow([string[]]$LogLines, [DateTime]$StartUtc, [DateTime]$EndUtc) {
    $rows = @()
    $warnings = 0
    $errors = 0
    $scrollHintEvents = 0

    foreach ($line in $LogLines) {
        if ($line -notmatch '^\[(?<ts>[^ ]+)\s+(?<level>[A-Z]+)\s+overlay_daemon\]\s+(?<msg>.*)$') {
            continue
        }

        $ts = Parse-UtcTimestamp $Matches["ts"]
        if ($ts -lt $StartUtc -or $ts -gt $EndUtc) {
            continue
        }

        $level = $Matches["level"]
        $msg = $Matches["msg"]

        if ($level -eq "WARN") { $warnings++ }
        if ($level -eq "ERROR") { $errors++ }

        if ($level -eq "INFO" -and $msg -match '^captured=(?<captured>\d+)\s+visible_anchors=(?<visible>\d+)\s+semantic_regions=(?<semantic>\d+)\s+move_rects=(?<move>\d+)\s+dirty_rects=(?<dirty>\d+)\s+readback_regions=(?<readback>\d+)\s+readback_kb=(?<kb>[0-9.]+)\s+accum=(?<accum>\d+)\s+scroll_hint=(?<scroll>[^\s]+)\s+uptime=(?<uptime>\d+)s$') {
            $row = [PSCustomObject]@{
                captured = [int]$Matches["captured"]
                visible = [int]$Matches["visible"]
                semantic = [int]$Matches["semantic"]
                move = [int]$Matches["move"]
                dirty = [int]$Matches["dirty"]
                readback = [int]$Matches["readback"]
                kb = [double]$Matches["kb"]
                scroll = $Matches["scroll"]
            }
            $rows += $row
            if ($row.scroll -ne "none") {
                $scrollHintEvents++
            }
        }
    }

    if ($rows.Count -eq 0) {
        return [PSCustomObject]@{
            sample_count = 0
            avg_visible_anchors = 0.0
            avg_semantic_regions = 0.0
            avg_dirty_rects = 0.0
            avg_readback_kb = 0.0
            visible_jitter = 0.0
            semantic_jitter = 0.0
            scroll_hint_events = 0
            warnings = $warnings
            errors = $errors
        }
    }

    $avgVisible = ($rows | Measure-Object -Property visible -Average).Average
    $avgSemantic = ($rows | Measure-Object -Property semantic -Average).Average
    $avgDirty = ($rows | Measure-Object -Property dirty -Average).Average
    $avgReadback = ($rows | Measure-Object -Property kb -Average).Average
    $visibleJitter = Get-StdDev -Values ([double[]]($rows | ForEach-Object { [double]$_.visible }))
    $semanticJitter = Get-StdDev -Values ([double[]]($rows | ForEach-Object { [double]$_.semantic }))

    return [PSCustomObject]@{
        sample_count = $rows.Count
        avg_visible_anchors = [Math]::Round($avgVisible, 2)
        avg_semantic_regions = [Math]::Round($avgSemantic, 2)
        avg_dirty_rects = [Math]::Round($avgDirty, 2)
        avg_readback_kb = [Math]::Round($avgReadback, 2)
        visible_jitter = [Math]::Round($visibleJitter, 2)
        semantic_jitter = [Math]::Round($semanticJitter, 2)
        scroll_hint_events = $scrollHintEvents
        warnings = $warnings
        errors = $errors
    }
}

function Ensure-ScreenshotAssemblies {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        Add-Type -AssemblyName System.Drawing -ErrorAction Stop
        return $true
    }
    catch {
        Write-Info "Screenshot assemblies unavailable: $($_.Exception.Message)"
        return $false
    }
}

function Save-Screenshot([string]$Path) {
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $gfx.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $gfx.Dispose()
        $bmp.Dispose()
    }
}

function Try-AppActivate([int]$ProcessId, [string[]]$TitleHints, [int]$TimeoutSeconds = 12) {
    $shell = New-Object -ComObject WScript.Shell
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if ($ProcessId -gt 0) {
            try {
                if ($shell.AppActivate($ProcessId)) {
                    Start-Sleep -Milliseconds 400
                    return $true
                }
            }
            catch {
                # Process might not yet be ready for activation.
            }
        }

        foreach ($hint in $TitleHints) {
            if ([string]::IsNullOrWhiteSpace($hint)) {
                continue
            }
            if ($shell.AppActivate($hint)) {
                Start-Sleep -Milliseconds 400
                return $true
            }
        }

        Start-Sleep -Milliseconds 300
    }
    return $false
}

function Send-ScrollKeys([int]$Count) {
    $shell = New-Object -ComObject WScript.Shell
    for ($i = 0; $i -lt $Count; $i++) {
        $shell.SendKeys("{PGDN}")
        Start-Sleep -Milliseconds 320
    }
}

function New-NotepadFixture([string]$RunDir) {
    $fixture = Join-Path $RunDir "fixture-notepad.txt"
    $paragraph = @"
Project Periphery overlay stress fixture.
This file intentionally contains many lines to test scrolling and text tracking.
The quick brown fox jumps over the lazy dog.
Dyslexia support should remain stable while scrolling quickly.
"@

    $content = @()
    for ($i = 1; $i -le 300; $i++) {
        $content += "$i`t$paragraph"
    }
    Set-Content -Path $fixture -Value $content -Encoding UTF8
    return $fixture
}

function New-ScenarioMatrix([string]$RepoRootPath, [string]$BrowserPath, [string]$RunDir) {
    $fixture = New-NotepadFixture $RunDir
    $scenarios = @(
        [PSCustomObject]@{
            name = "App-Notepad-LongText"
            kind = "app"
            expected_text = $true
            launch = "notepad.exe"
            args = @($fixture)
            activate_hints = @("Notepad")
        },
        [PSCustomObject]@{
            name = "App-PowerShell-README"
            kind = "app"
            expected_text = $true
            launch = "powershell.exe"
            args = @("-NoExit", "-Command", "Get-Content -Path '$RepoRootPath\README.md'")
            activate_hints = @("Windows PowerShell", "PowerShell")
        }
    )

    if ($BrowserPath) {
        $webScenarios = @(
            [PSCustomObject]@{ name = "Web-Wikipedia-Dyslexia"; url = "https://en.wikipedia.org/wiki/Dyslexia"; activate_hints = @("Wikipedia", "Dyslexia") },
            [PSCustomObject]@{ name = "Web-BBC-News"; url = "https://www.bbc.com/news"; activate_hints = @("BBC", "News") },
            [PSCustomObject]@{ name = "Web-GitHub-Repo"; url = "https://github.com"; activate_hints = @("GitHub") },
            [PSCustomObject]@{ name = "Web-OpenAI-Docs"; url = "https://platform.openai.com/docs"; activate_hints = @("OpenAI", "Docs") }
        )

        foreach ($web in $webScenarios) {
            $scenarios += [PSCustomObject]@{
                name = $web.name
                kind = "web"
                expected_text = $true
                launch = $BrowserPath
                args = @($web.url)
                activate_hints = $web.activate_hints
            }
        }
    }

    return $scenarios
}

function Start-ScenarioProcess($Scenario, [string]$RunDir) {
    if ($Scenario.kind -eq "app") {
        return Start-Process -FilePath $Scenario.launch -ArgumentList $Scenario.args -PassThru
    }

    if ($Scenario.kind -eq "web") {
        $profileDir = Join-Path $RunDir ("profile-" + $Scenario.name)
        Ensure-Directory $profileDir
        $args = @("--new-window", "--user-data-dir=$profileDir", "--disable-session-crashed-bubble")
        $args += $Scenario.args
        return Start-Process -FilePath $Scenario.launch -ArgumentList $args -PassThru
    }

    throw "Unknown scenario kind: $($Scenario.kind)"
}

function Wait-ForMinimumSamples(
    [string]$StdoutPath,
    [string]$StderrPath,
    [DateTime]$StartUtc,
    [int]$RequiredSamples,
    [int]$MaxExtraWaitSeconds
) {
    $deadline = [DateTime]::UtcNow.AddSeconds($MaxExtraWaitSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $metrics = Get-MetricsForWindow `
            -LogLines (Get-LogLines -StdoutPath $StdoutPath -StderrPath $StderrPath) `
            -StartUtc $StartUtc `
            -EndUtc ([DateTime]::UtcNow)

        if ($metrics.sample_count -ge $RequiredSamples) {
            break
        }

        Start-Sleep -Seconds 1
    }

    return [DateTime]::UtcNow
}

function Get-ScenarioStatus(
    $Scenario,
    $Metrics,
    [int]$RequiredSamples,
    [double]$MaxVisibleJitterThreshold,
    [double]$MaxSemanticJitterThreshold,
    [bool]$EnableJitterGate
) {
    if ($Metrics.sample_count -lt $RequiredSamples) {
        return "FAIL"
    }
    if ($Metrics.errors -gt 0) {
        return "FAIL"
    }
    if ($Scenario.expected_text -and ($Metrics.avg_visible_anchors -lt 1 -or $Metrics.avg_semantic_regions -lt 1)) {
        return "FAIL"
    }
    if (
        $EnableJitterGate -and
        $Scenario.expected_text -and
        (
            $Metrics.visible_jitter -gt $MaxVisibleJitterThreshold -or
            $Metrics.semantic_jitter -gt $MaxSemanticJitterThreshold
        )
    ) {
        return "FAIL"
    }
    return "PASS"
}

function Write-MarkdownReport([string]$Path, [object[]]$Results) {
    $lines = @()
    $lines += "# Overlay Matrix Test Report"
    $lines += ""
    $lines += "| Scenario | Kind | Status | Samples | Avg Visible | Visible Jitter | Avg Semantic | Semantic Jitter | Avg Dirty | Avg Readback KB | Warnings | Errors | Scroll Hints |"
    $lines += "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"

    foreach ($result in $Results) {
        $m = $result.metrics
        $lines += "| $($result.name) | $($result.kind) | $($result.status) | $($m.sample_count) | $($m.avg_visible_anchors) | $($m.visible_jitter) | $($m.avg_semantic_regions) | $($m.semantic_jitter) | $($m.avg_dirty_rects) | $($m.avg_readback_kb) | $($m.warnings) | $($m.errors) | $($m.scroll_hint_events) |"
    }

    Set-Content -Path $Path -Value $lines -Encoding UTF8
}

$runDir = New-RunDirectory $OutputRoot
$stdoutLog = Join-Path $runDir "overlay-daemon.stdout.log"
$stderrLog = Join-Path $runDir "overlay-daemon.stderr.log"
$jsonReport = Join-Path $runDir "report.json"
$mdReport = Join-Path $runDir "report.md"

Write-Info "Run directory: $runDir"

$browserPath = Resolve-BrowserPath
if ($browserPath) {
    Write-Info "Browser detected: $browserPath"
}
else {
    Write-Info "No Edge/Chrome detected. Web scenarios will be skipped."
}

$scenarios = New-ScenarioMatrix -RepoRootPath $RepoRoot -BrowserPath $browserPath -RunDir $runDir
Write-Info ("Scenario count: " + $scenarios.Count)
if ($DisableJitterGate) {
    Write-Info "Jitter gate: disabled"
}
else {
    Write-Info ("Jitter gate: enabled (visible <= {0}, semantic <= {1})" -f $MaxVisibleJitter, $MaxSemanticJitter)
}

if ($DryRun) {
    Write-Info "DryRun enabled. Planned scenarios:"
    $scenarios | ForEach-Object { Write-Info (" - " + $_.name + " [" + $_.kind + "]") }
    return
}

$overlayExe = Ensure-OverlayBinary $RepoRoot
Write-Info "Overlay daemon: $overlayExe"

$overlayProcess = $null
$screenshotReady = Ensure-ScreenshotAssemblies

try {
    $overlayProcess = Start-OverlayDaemon -OverlayExe $overlayExe -WorkingDir $RepoRoot -StdoutPath $stdoutLog -StderrPath $stderrLog
    Write-Info "overlay-daemon pid: $($overlayProcess.Id)"

    if (-not (Wait-ForOverlayStartup -StdoutPath $stdoutLog -StderrPath $stderrLog -TimeoutSeconds 20)) {
        throw "overlay-daemon did not report startup in time"
    }
    Write-Info "overlay-daemon startup confirmed."

    $results = @()
    foreach ($scenario in $scenarios) {
        Write-Info ("Running scenario: " + $scenario.name)
        $proc = $null
        $startUtc = [DateTime]::UtcNow
        $endUtc = $startUtc
        $screenshotPath = Join-Path $runDir ("screenshot-" + $scenario.name + ".png")

        try {
            $proc = Start-ScenarioProcess -Scenario $scenario -RunDir $runDir
            Start-Sleep -Seconds 2

            $activated = Try-AppActivate -ProcessId $proc.Id -TitleHints $scenario.activate_hints -TimeoutSeconds 14
            if (-not $activated) {
                Write-Info ("Could not activate window for: " + $scenario.name)
            }

            Start-Sleep -Seconds $WarmupSeconds
            $startUtc = [DateTime]::UtcNow
            Send-ScrollKeys -Count $ScrollEvents
            Start-Sleep -Seconds $DurationSeconds
            $endUtc = Wait-ForMinimumSamples `
                -StdoutPath $stdoutLog `
                -StderrPath $stderrLog `
                -StartUtc $startUtc `
                -RequiredSamples $MinSamples `
                -MaxExtraWaitSeconds $MaxExtraSampleWaitSeconds

            if ($screenshotReady) {
                Save-Screenshot -Path $screenshotPath
            }
        }
        finally {
            Stop-ProcessSafe $proc
        }

        $metrics = Get-MetricsForWindow -LogLines (Get-LogLines -StdoutPath $stdoutLog -StderrPath $stderrLog) -StartUtc $startUtc -EndUtc $endUtc
        $status = Get-ScenarioStatus `
            -Scenario $scenario `
            -Metrics $metrics `
            -RequiredSamples $MinSamples `
            -MaxVisibleJitterThreshold $MaxVisibleJitter `
            -MaxSemanticJitterThreshold $MaxSemanticJitter `
            -EnableJitterGate (-not $DisableJitterGate)

        $screenshotValue = ""
        if (Test-Path -LiteralPath $screenshotPath) {
            $screenshotValue = $screenshotPath
        }

        $result = [PSCustomObject]@{
            name = $scenario.name
            kind = $scenario.kind
            status = $status
            start_utc = $startUtc.ToString("o")
            end_utc = $endUtc.ToString("o")
            screenshot = $screenshotValue
            metrics = $metrics
        }
        $results += $result

        Write-Info ("Scenario complete: {0} => {1} (samples={2})" -f $scenario.name, $status, $metrics.sample_count)
        Start-Sleep -Milliseconds 500
    }

    $summary = [PSCustomObject]@{
        generated_utc = [DateTime]::UtcNow.ToString("o")
        repo_root = $RepoRoot
        run_directory = $runDir
        overlay_stdout_log = $stdoutLog
        overlay_stderr_log = $stderrLog
        scenarios = $results
    }

    $summary | ConvertTo-Json -Depth 8 | Set-Content -Path $jsonReport -Encoding UTF8
    Write-MarkdownReport -Path $mdReport -Results $results

    $passed = @($results | Where-Object { $_.status -eq "PASS" }).Count
    $failed = @($results | Where-Object { $_.status -eq "FAIL" }).Count
    Write-Info ("Completed: PASS={0}, FAIL={1}" -f $passed, $failed)
    Write-Info "JSON report: $jsonReport"
    Write-Info "Markdown report: $mdReport"
}
finally {
    Stop-ProcessSafe $overlayProcess
}
