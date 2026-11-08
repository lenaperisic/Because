@echo off
rem Builds folio.jar from source. Requires Java 17 or newer (JDK).
cd /d "%~dp0"
if exist build rmdir /s /q build
mkdir build\classes
javac -encoding UTF-8 --release 17 -d build\classes src\main\java\folio\*.java || exit /b 1
xcopy /e /i /q src\main\resources build\classes >nul
echo Main-Class: folio.App> build\manifest.txt
jar cfm folio.jar build\manifest.txt -C build\classes .
echo Done: folio.jar
