@echo off

call npm run build
if errorlevel 1 (
    echo Build failed.
    exit /b 1
)

if not exist "..\packs" mkdir "..\packs"

call npm pack --pack-destination "..\packs"
if errorlevel 1 (
    echo npm pack failed.
    exit /b 1
)

echo Done. Use distrubution package from "..\packs\".
