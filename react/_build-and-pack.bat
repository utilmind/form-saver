@echo off

call npm run test:run
if errorlevel 1 (
    echo Test failed.
    exit /b 1
)

if exist "dist" rmdir /s /q "dist"

call npm run build
if errorlevel 1 (
    echo Build failed.
    exit /b 1
)

if not exist "..\_packs" mkdir "..\_packs"

copy /y "..\LICENSE.txt" "LICENSE.txt" >nul
if errorlevel 1 (
    echo Failed to copy LICENSE.txt.
    exit /b 1
)

call npm pack --pack-destination "..\_packs"
if errorlevel 1 (
    echo npm pack failed.
    exit /b 1
)

echo Done. Use distribution package from "..\_packs\".
