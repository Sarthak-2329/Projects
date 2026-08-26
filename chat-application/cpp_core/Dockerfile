# Stage 1: Compile the C++ engine
FROM gcc:14-bookworm AS builder

WORKDIR /build

COPY src/ ./src/
COPY include/ ./include/

RUN g++ -std=c++17 \
    src/main.cpp src/socket_engine.cpp src/room_manager.cpp \
    -I./include \
    -pthread \
    -O2 \
    -o cpp_chat_core


# Stage 2: Minimal runtime image
FROM debian:bookworm-slim

WORKDIR /app

COPY --from=builder /build/cpp_chat_core .

# The engine listens on port 8080 (its own TCP protocol — see README)
EXPOSE 8080

CMD ["./cpp_chat_core"]
