@echo off

where /q git
if errorlevel 1 (
    echo You must install Git to proceed: https://git-scm.com
    exit /b
)

where /q node
if errorlevel 1 (
    echo You must install Node to proceed: https://nodejs.org/en
    exit /b
)

for /f "tokens=2 delims=v." %%i in ('node -v') do set "node_major=%%i"
if %node_major% lss 22 (
    echo Node 22 or newer is required. Detected %node_major%
    exit /b
)

where /q bun
if errorlevel 1 (
    npm i -g bun
)

where /q bun
if errorlevel 1 (
    echo You must install Bun to proceed: https://bun.sh
    exit /b
)

where /q java
if errorlevel 1 (
    echo You must install Java 17 or newer to proceed: https://adoptium.net/
    exit /b
)

for /f tokens^=2-5^ delims^=.-_^" %%j in ('java -fullversion 2^>^&1') do set "jver=%%j%%k%"
if %jver% lss 170 (
    echo You must install Java 17 or newer to proceed: https://adoptium.net/
    echo And it must be your primary Java version!
    exit /b
)

bun install
bun run start.ts
