@echo off

set "TGZ=..\_packs\form-saver-react-0.1.0.tgz"

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

REM call node -e "const fs=require('fs'),crypto=require('crypto');const file=process.argv[1];console.log('sha512-'+crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64'))" "%TGZ%"
for /f "delims=" %%I in ('node -e "const fs=require('fs'),crypto=require('crypto');const file=process.argv[1];process.stdout.write('sha512-'+crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64'))" "%TGZ%"') do (
    set "INTEGRITY=%%I"
)

echo.
echo Package:   %TGZ%
echo Integrity: %INTEGRITY%
echo Done.
