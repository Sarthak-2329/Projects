#!/usr/bin/env bash
# Build and run the C++ unit tests.
# Exits 0 if all tests pass, non-zero on any failure.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CPP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$CPP_ROOT/build/tests"
mkdir -p "$BUILD_DIR"

echo "[tests] Compiling C++ tests..."

g++ -std=c++17 \
    "$SCRIPT_DIR/test_room_manager.cpp" \
    "$CPP_ROOT/src/room_manager.cpp" \
    -I"$CPP_ROOT/include" \
    -I"$SCRIPT_DIR" \
    -pthread \
    -O0 -g \
    -o "$BUILD_DIR/run_tests"

echo "[tests] Running tests..."
"$BUILD_DIR/run_tests"
