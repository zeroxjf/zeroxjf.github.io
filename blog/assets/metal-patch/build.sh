#!/bin/zsh
set -e
cd "$(dirname "$0")"

xcrun -sdk iphoneos clang++ \
    -arch arm64e \
    -miphoneos-version-min=26.1 \
    -dynamiclib \
    -std=c++17 \
    -w -Wl,-w \
    -Wl,-undefined,dynamic_lookup \
    -Wl,-not_for_dyld_shared_cache \
    main.mm \
    -o libAppleParavirtCompilerPluginIOGPUFamily.dylib \
    -install_name /System/Library/Extensions/AppleParavirtGPUMetalIOGPUFamily.bundle/libAppleParavirtCompilerPluginIOGPUFamily.dylib \
    -O2

codesign -f -s - libAppleParavirtCompilerPluginIOGPUFamily.dylib

echo "Built and signed libAppleParavirtCompilerPluginIOGPUFamily.dylib ($(wc -c < libAppleParavirtCompilerPluginIOGPUFamily.dylib) bytes)"
