#!/usr/bin/env bash
# Cross-platform build script for the C++ chat engine.
# Tries CMake first; falls back to direct g++ with platform-appropriate flags.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
INC_DIR="$SCRIPT_DIR/include"
BUILD_DIR="$SCRIPT_DIR/build"

mkdir -p "$BUILD_DIR"

# ---------- Try CMake first ----------
if command -v cmake &>/dev/null; then
    echo "[build.sh] CMake found — using CMake build"
    cmake -S "$SCRIPT_DIR" -B "$BUILD_DIR"
    cmake --build "$BUILD_DIR"
    echo "[build.sh] Build complete: $BUILD_DIR/cpp_chat_core"
    exit 0
fi

# ---------- Fallback: direct g++ ----------
echo "[build.sh] CMake not found — falling back to direct g++ compilation"

if ! command -v g++ &>/dev/null; then
    echo "[build.sh] ERROR: Neither cmake nor g++ found. Install one of them." >&2
    exit 1
fi

SOURCES="$SRC_DIR/main.cpp $SRC_DIR/socket_engine.cpp $SRC_DIR/room_manager.cpp"
OUTPUT="$BUILD_DIR/cpp_chat_core"

# Platform-specific linker flags
case "$(uname -s)" in
    CYGWIN*|MINGW*|MSYS*)
        PLATFORM_LIBS="-lws2_32"
        OUTPUT="$BUILD_DIR/cpp_chat_core.exe"
        ;;
    *)
        PLATFORM_LIBS="-pthread"
        ;;
esac

echo "[build.sh] Compiling: g++ -std=c++17 $SOURCES -I$INC_DIR $PLATFORM_LIBS -o $OUTPUT"
g++ -std=c++17 $SOURCES -I"$INC_DIR" $PLATFORM_LIBS -o "$OUTPUT"
echo "[build.sh] Build complete: $OUTPUT"
