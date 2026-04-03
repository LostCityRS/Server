@echo off

where /q git
if errorlevel 1 (
    echo You must install Git to proceed: https://git-scm.com
    exit /b
)

where /q bun
if errorlevel 1 (
    where /q node
    if errorlevel 0 (
        npm i -g bun
    )

    where /q bun
    if errorlevel 1 (
        echo You must install Bun to proceed: https://bun.sh
        exit /b
    )
)

@REM where /q java
@REM if errorlevel 1 (
@REM     echo You must install Java 17 or newer to proceed: https://adoptium.net/
@REM     exit /b
@REM )

@REM for /f tokens^=2-5^ delims^=.-_^" %%j in ('java -fullversion 2^>^&1') do set "jver=%%j%%k%"
@REM if %jver% lss 170 (
@REM     echo You must install Java 17 or newer to proceed: https://adoptium.net/
@REM     echo And it must be your primary Java version!
@REM     exit /b
@REM )

bun install
bun run start.ts
