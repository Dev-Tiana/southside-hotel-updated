param([ValidateSet('Setup','Check','Start','Diagnose')][string]$Action='Setup')
$ErrorActionPreference='Stop'
$phase9Root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$phase9Directory=Join-Path $env:LOCALAPPDATA 'SouthSideHotel\PaystackTest'
$phase9File=Join-Path $phase9Directory 'credentials.clixml'
function Get-PrivateText([Security.SecureString]$Value){
    $privatePointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($privatePointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($privatePointer) }
}
$phase9Keys=$null
try {
    if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Windows only'}
    if($Action -eq 'Setup'){
        Write-Host 'Paystack TEST credentials only. Use your own development account in Test mode.'
        Write-Host 'Nothing entered here is sent to chat. This setup makes no provider request.'
        if(Test-Path -LiteralPath $phase9File){throw 'Existing credential store; do not overwrite'}
        $phase9Keys=[pscustomobject]@{SecretKey=(Read-Host 'Paste TEST SECRET key privately (sk_test_)' -AsSecureString);PublicKey=(Read-Host 'Paste TEST PUBLIC key privately (pk_test_)' -AsSecureString)}
        if((Get-PrivateText $phase9Keys.SecretKey) -cnotmatch '^sk_test_[A-Za-z0-9]+$' -or (Get-PrivateText $phase9Keys.PublicKey) -cnotmatch '^pk_test_[A-Za-z0-9]+$'){throw 'Test prefixes required'}
        $null=New-Item -ItemType Directory -Path $phase9Directory -Force
        $phase9Keys | Export-Clixml -LiteralPath $phase9File -Depth 3 -NoClobber
        Write-Host 'Encrypted test keys saved outside the repository for this Windows user/computer.'
        Write-Host 'Running LOCAL preflight only; this will not initialize a transaction.'
    }else{$phase9Keys=Import-Clixml -LiteralPath $phase9File}
    $env:PAYSTACK_SECRET_KEY=Get-PrivateText $phase9Keys.SecretKey
    $env:PAYSTACK_PUBLIC_KEY=Get-PrivateText $phase9Keys.PublicKey
    Push-Location -LiteralPath $phase9Root
    try {
        if($Action -eq 'Diagnose'){
            Write-Host 'Read-only verification of the existing Phase 9 reference only. No initialization, settlement or database writes.'
            & node --import tsx (Join-Path $PSScriptRoot 'paystack-diagnose.ts')
        }else{
            $phase9Mode=if($Action -eq 'Start'){'--start'}else{'--preflight'}
            & node (Join-Path $PSScriptRoot 'paystack-test-app.mjs') $phase9Mode
        }
        if($LASTEXITCODE -ne 0){throw 'Local preflight/start failed'}
    }finally{Pop-Location}
}catch {
    Write-Host 'Setup/preflight stopped. Check test-only key prefixes, the private Windows store and the owned local database. Existing keys are never overwritten and no secrets are displayed.' -ForegroundColor Yellow
    exit 1
}finally {
    Remove-Item Env:PAYSTACK_SECRET_KEY,Env:PAYSTACK_PUBLIC_KEY -ErrorAction SilentlyContinue
    if($phase9Keys){$phase9Keys.SecretKey.Dispose();$phase9Keys.PublicKey.Dispose()}
}
