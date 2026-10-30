$ErrorActionPreference = 'Stop'
$OutputEncoding = [Text.UTF8Encoding]::new($false)
Set-Location ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')))
Write-Host 'This creates ONE administrator in the isolated local development database only.'
Write-Host 'Do not enter production credentials or share your password in chat.'
$confirmation = Read-Host 'Type CREATE LOCAL ADMINISTRATOR to explicitly authorize'
if ($confirmation -cne 'CREATE LOCAL ADMINISTRATOR') { throw 'Authorization not given. Nothing was created.' }
$staffName = Read-Host 'Your local staff display name'
$staffEmail = Read-Host 'Your local staff email'
$secret = Read-Host 'Choose a unique password (15 to 128 characters)' -AsSecureString
$confirmationSecret = Read-Host 'Confirm password' -AsSecureString
$passwordPointer = [IntPtr]::Zero
$confirmationPointer = [IntPtr]::Zero
try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $confirmationPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmationSecret)
    $passwordText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $confirmationText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmationPointer)
    if ($passwordText -cne $confirmationText) { throw 'Passwords do not match. Nothing was created.' }
    $inputJson = @{ name=$staffName; email=$staffEmail; password=$passwordText; confirmation=$confirmation } | ConvertTo-Json -Compress
    # Password travels only through anonymous stdin, never command arguments or files.
    $inputJson | node scripts/local/admin-setup.mjs --authorize-initial-admin
    if ($LASTEXITCODE -ne 0) { throw 'Administrator setup failed; no credentials were printed.' }
} finally {
    if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
    if ($confirmationPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmationPointer) }
    $passwordText = $null; $confirmationText = $null; $inputJson = $null
    $secret.Dispose(); $confirmationSecret.Dispose()
}
