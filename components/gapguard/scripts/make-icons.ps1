$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$iconDirectory = Join-Path $projectRoot 'assets/icons'
[IO.Directory]::CreateDirectory($iconDirectory) | Out-Null

# One geometric source for both the editable SVG and raster exports.
$shield = @(
    @('M',32,3), @('L',57,12), @('L',57,30),
    @('C',57,44,46,55,32,61), @('C',18,55,7,44,7,30),
    @('L',7,12), @('Z')
)
$glyph = @(
    @('M',45,23), @('L',40,28), @('C',38,25,35,23,31,23),
    @('C',25,23,21,27,21,33), @('C',21,39,25,43,31,43),
    @('C',35,43,38,42,40,40), @('L',40,37), @('L',31,37),
    @('L',31,30), @('L',47,30), @('L',47,43),
    @('C',43,48,37,50,31,50), @('C',21,50,14,43,14,33),
    @('C',14,23,21,16,31,16), @('C',37,16,42,18,45,23), @('Z')
)

function ConvertTo-SvgPath($commands) {
    return (($commands | ForEach-Object { $_ -join ' ' }) -join ' ')
}

function New-IconPath($commands) {
    $result = [Drawing.Drawing2D.GraphicsPath]::new()
    [single]$currentX = 0
    [single]$currentY = 0
    foreach ($command in $commands) {
        switch ($command[0]) {
            'M' { $result.StartFigure(); $currentX = $command[1]; $currentY = $command[2] }
            'L' {
                $result.AddLine($currentX, $currentY, [single]$command[1], [single]$command[2])
                $currentX = $command[1]; $currentY = $command[2]
            }
            'C' {
                $result.AddBezier($currentX, $currentY, [single]$command[1], [single]$command[2], [single]$command[3], [single]$command[4], [single]$command[5], [single]$command[6])
                $currentX = $command[5]; $currentY = $command[6]
            }
            'Z' { $result.CloseFigure() }
        }
    }
    return ,$result
}

$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>GapGuard</title><path fill="#75e1bc" stroke="#0c2720" stroke-width="2" stroke-linejoin="round" d="' + (ConvertTo-SvgPath $shield) + '"/><path fill="#0c2720" d="' + (ConvertTo-SvgPath $glyph) + '"/></svg>'
[IO.File]::WriteAllText((Join-Path $iconDirectory 'gapguard.svg'), $svg, [Text.UTF8Encoding]::new($false))
$shieldPath = New-IconPath $shield
$glyphPath = New-IconPath $glyph
$mint = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#75e1bc'))
$navy = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#0c2720'))
$outline = [Drawing.Pen]::new($navy.Color, 2)
$outline.LineJoin = [Drawing.Drawing2D.LineJoin]::Round

foreach ($size in @(16, 32, 48, 128, 256, 512)) {
    $working = [Drawing.Bitmap]::new($size * 4, $size * 4, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $canvas = [Drawing.Graphics]::FromImage($working)
    $canvas.Clear([Drawing.Color]::Transparent)
    $canvas.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $canvas.ScaleTransform([single]($size * 4 / 64), [single]($size * 4 / 64))
    $canvas.FillPath($mint, $shieldPath)
    $canvas.DrawPath($outline, $shieldPath)
    $canvas.FillPath($navy, $glyphPath)
    $canvas.Dispose()
    $output = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $scaled = [Drawing.Graphics]::FromImage($output)
    $scaled.Clear([Drawing.Color]::Transparent)
    $scaled.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
    $scaled.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $scaled.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $scaled.DrawImage($working, [Drawing.Rectangle]::new(0, 0, $size, $size), 0, 0, $working.Width, $working.Height, [Drawing.GraphicsUnit]::Pixel)
    $output.Save((Join-Path $iconDirectory "icon-$size.png"), [Drawing.Imaging.ImageFormat]::Png)
    $scaled.Dispose(); $output.Dispose(); $working.Dispose()
}
$outline.Dispose(); $mint.Dispose(); $navy.Dispose(); $shieldPath.Dispose(); $glyphPath.Dispose()
Write-Output 'Created editable SVG and PNG icons at 16, 32, 48, 128, 256, and 512 pixels.'
