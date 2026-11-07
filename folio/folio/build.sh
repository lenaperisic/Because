#!/usr/bin/env bash
# Pravi folio.jar iz izvornog koda. Potrebna je Java 17 ili novija (JDK).
set -e
cd "$(dirname "$0")"
rm -rf build
mkdir -p build/classes
javac -encoding UTF-8 --release 17 -d build/classes src/main/java/folio/*.java
cp -r src/main/resources/* build/classes/
printf "Main-Class: folio.App\n" > build/manifest.txt
jar cfm folio.jar build/manifest.txt -C build/classes .
echo "Gotovo: folio.jar"
