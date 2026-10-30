param([Parameter(Mandatory=$true)][ValidateRange(1,2147483647)][int]$ServerProcessId)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$expectedExecutable = [IO.Path]::GetFullPath((Join-Path $projectRoot '.local/mysql-8.4.13-winx64/bin/mysqld.exe'))
$serverProcess = Get-Process -Id $ServerProcessId
if ([IO.Path]::GetFullPath($serverProcess.Path) -ne $expectedExecutable) {
    throw 'Refusing to stop a process outside the owned portable MySQL installation.'
}
# MySQL 8.4 sql/mysqld.cc creates MYSQLShutdown<PID> for graceful Windows stop.
# https://github.com/mysql/mysql-server/blob/8.4/sql/mysqld.cc
try {
    $shutdownEvent = [Threading.EventWaitHandle]::OpenExisting("MYSQLShutdown$ServerProcessId")
} catch [Threading.WaitHandleCannotBeOpenedException] {
    # The first bootstrap used MySQL's optional monitor. Verify that parent too.
    $serverInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$ServerProcessId"
    $monitorProcessId = [int]$serverInfo.ParentProcessId
    $monitorProcess = Get-Process -Id $monitorProcessId
    if ([IO.Path]::GetFullPath($monitorProcess.Path) -ne $expectedExecutable) {
        throw 'Refusing an unrecognized MySQL monitor process.'
    }
    $shutdownEvent = [Threading.EventWaitHandle]::OpenExisting("mysqld${monitorProcessId}_shutdown")
}
try {
    if (-not $shutdownEvent.Set()) { throw 'MySQL shutdown event could not be signaled.' }
} finally { $shutdownEvent.Dispose() }
if (-not $serverProcess.WaitForExit(30000)) { throw 'Orderly shutdown is still pending; no force-stop was used.' }
Write-Output 'Owned local MySQL stopped gracefully.'
