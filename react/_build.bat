@echo off

call npm run build
if errorlevel 1 (
    echo Build failed.
    exit /b 1
)

call npm pack
if errorlevel 1 (
    echo npm pack failed.
    exit /b 1
)

echo Done.