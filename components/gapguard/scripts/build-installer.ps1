$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version = (Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version
$buildDirectory = Join-Path $taskRoot 'installer/build'
[IO.Directory]::CreateDirectory($buildDirectory) | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Build an ICO container from the existing PNG exports without redrawing them.
$iconPath = Join-Path $taskRoot 'assets/icons/gapguard.ico'
$iconStream = [IO.File]::Create($iconPath)
$writer = [IO.BinaryWriter]::new($iconStream)
try {
    $sizes = @(16, 32, 48, 128, 256)
    $images = @($sizes | ForEach-Object { ,([IO.File]::ReadAllBytes((Join-Path $taskRoot "assets/icons/icon-$_.png"))) })
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
    [uint32]$offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        [byte]$edge = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
        $writer.Write($edge); $writer.Write($edge); $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$images[$i].Length); $writer.Write($offset)
        $offset += $images[$i].Length
    }
    foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
} finally { $writer.Dispose(); $iconStream.Dispose() }

$payloadPath = Join-Path $buildDirectory 'payload.zip'
$payloadStream = [IO.File]::Open($payloadPath, [IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($payloadStream, [IO.Compression.ZipArchiveMode]::Create)
function Add-PackageFile([string]$source, [string]$entry) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $source, $entry, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
try {
    $extensionRoot = Join-Path $taskRoot 'extension'
    foreach ($file in Get-ChildItem -LiteralPath $extensionRoot -Recurse -File) {
        $relative = $file.FullName.Substring($extensionRoot.Length + 1).Replace('\', '/')
        Add-PackageFile $file.FullName ('extension/' + $relative)
    }
    foreach ($directory in @('src', 'ui', 'scripts', 'test', 'assets', 'sources')) {
        $sourceRoot = Join-Path $taskRoot $directory
        foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -Recurse -File) {
            $relative = $file.FullName.Substring($taskRoot.Length + 1).Replace('\', '/')
            Add-PackageFile $file.FullName ('source/' + $relative)
        }
    }
    foreach ($relative in @('package.json', 'package-lock.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'TESTING.md', '.gitignore', 'installer/GapGuardSetup.cs', 'installer/app.manifest', 'reports/build-report.json', 'reports/DEPENDENCIES.md')) {
        Add-PackageFile (Join-Path $taskRoot $relative) ('source/' + $relative)
    }
    Add-PackageFile (Join-Path $taskRoot 'README.md') 'source/README.md'
    # Local notes and audit output are optional; a fresh clone does not contain them.
    foreach ($relative in @('BUILD_NOTES.md', 'reports/dependency-audit.json')) {
        $optionalPath = Join-Path $taskRoot $relative
        if (Test-Path -LiteralPath $optionalPath -PathType Leaf) {
            Add-PackageFile $optionalPath ('source/' + $relative)
        }
    }
} finally { $archive.Dispose(); $payloadStream.Dispose() }

$payloadHash = (Get-FileHash -LiteralPath $payloadPath -Algorithm SHA256).Hash.ToLowerInvariant()
$buildInfo = Join-Path $buildDirectory 'BuildInfo.g.cs'
[IO.File]::WriteAllText($buildInfo, ('namespace GapGuardSetup { internal static class BuildInfo { internal const string Version = "' + $version + '"; internal const string PayloadSha256 = "' + $payloadHash + '"; } }'), [Text.UTF8Encoding]::new($false))
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe' }
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The Windows .NET Framework C# compiler is unavailable.' }
$output = Join-Path $taskRoot "GapGuard-Setup-$version.exe"
& $compiler /nologo /target:winexe /optimize+ /platform:anycpu /codepage:65001 "/out:$output" "/win32icon:$iconPath" "/win32manifest:$(Join-Path $taskRoot 'installer/app.manifest')" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "/resource:$payloadPath,GapGuard.Payload.zip" "/resource:$(Join-Path $taskRoot 'assets/branding/github-banner.png'),GapGuard.Banner.png" "/resource:$iconPath,GapGuard.Icon.ico" (Join-Path $taskRoot 'installer/GapGuardSetup.cs') $buildInfo
if ($LASTEXITCODE -ne 0) { throw "Installer compiler failed: $LASTEXITCODE" }
$verificationPath = Join-Path $taskRoot 'reports/installer-verification.json'
$process = Start-Process -FilePath $output -ArgumentList @('--self-check', ('"' + $verificationPath + '"')) -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw (Get-Content -LiteralPath $verificationPath -Raw) }
Get-Content -LiteralPath $verificationPath -Raw
Get-FileHash -LiteralPath $output -Algorithm SHA256 | ForEach-Object { 'Setup SHA256: ' + $_.Hash }
Write-Output ('Created ' + $output)
