#include <iostream>
#include <csignal>
#include <memory>
#include "../include/socket_engine.hpp"

volatile sig_atomic_t g_running = 1;

void signalHandler(int) {
    g_running = 0;
}

int main(int argc, char* argv[]) {
    int port = 8080;
    if (argc > 1) {
        port = std::atoi(argv[1]);
    }

    // Register signal handlers for clean shutdown
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);

    std::cout << "===================================================" << std::endl;
    std::cout << "   C++ Core High-Concurrency Networking Engine    " << std::endl;
    std::cout << "===================================================" << std::endl;

    auto engine = std::make_unique<SocketEngine>(port, 8);
    if (!engine->start()) {
        std::cerr << "[Main]: Engine failed to start!" << std::endl;
        return 1;
    }

    return 0;
}
