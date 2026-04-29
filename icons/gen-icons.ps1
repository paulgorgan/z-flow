Add-Type -AssemblyName System.Drawing

function New-ZFlowIcon {
    param([int]$Size, [string]$OutPath, [bool]$Maskable)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background gradient #1e3a8a -> #3b82f6 diagonal
    $rect  = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $c1    = [System.Drawing.Color]::FromArgb(255, 30, 58, 138)
    $c2    = [System.Drawing.Color]::FromArgb(255, 59, 130, 246)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 135)

    if ($Maskable) {
        $g.FillRectangle($brush, $rect)
    } else {
        $radius = [int]($Size * 100.0 / 512.0)
        $d = $radius * 2
        $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
        $gp.AddArc(0,          0,          $d, $d, 180, 90)
        $gp.AddArc($Size - $d, 0,          $d, $d, 270, 90)
        $gp.AddArc($Size - $d, $Size - $d, $d, $d, 0,   90)
        $gp.AddArc(0,          $Size - $d, $d, $d, 90,  90)
        $gp.CloseFigure()
        $g.SetClip($gp)
        $g.FillRectangle($brush, $rect)
        $g.ResetClip()
        $gp.Dispose()
    }

    # Text "ZF" — Arial Black Bold Italic, 50% of icon size
    $fontSize = [int]($Size * 0.50)
    $style    = [System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic
    $font     = New-Object System.Drawing.Font("Arial Black", $fontSize, $style)
    $white    = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $sf       = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    # Slight downward offset to match SVG text anchor y=320 (center=256 at 512px)
    $cy = [float]($Size / 2) + [float]($Size * 0.025)
    $g.DrawString("ZF", $font, $white, [float]($Size / 2), $cy, $sf)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $font.Dispose(); $white.Dispose(); $g.Dispose(); $bmp.Dispose()
    Write-Host "Generat: $OutPath ($Size x $Size)"
}

$base = Split-Path -Parent $MyInvocation.MyCommand.Path

New-ZFlowIcon -Size 192 -OutPath "$base\icon-192.png"          -Maskable $false
New-ZFlowIcon -Size 512 -OutPath "$base\icon-512.png"          -Maskable $false
New-ZFlowIcon -Size 192 -OutPath "$base\icon-maskable-192.png" -Maskable $true

Write-Host "`nFisiere in icons/:"
Get-ChildItem $base | Select-Object Name, Length
