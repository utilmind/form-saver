@echo off

call npm run build
if errorlevel 1 (
    echo Build failed.
    exit /b 1
)

if not exist "..\_packs" mkdir "..\_packs"

call npm pack --pack-destination "..\_packs"
if errorlevel 1 (
    echo npm pack failed.
    exit /b 1
)

echo Done. Use distrubution package from "..\_packs\".
