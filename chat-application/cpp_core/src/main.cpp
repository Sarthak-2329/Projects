#include <iostream>
#include <csignal>
#include <memory>
#include "../include/socket_engine.hpp"

std::unique_ptr<SocketEngine> g_engine = nullptr;

void signalHandler(int signum) {
    std::cout << "\n[Signal Received " << signum << "]: Shutting down C++ High-Concurrency Engine gracefully..." << std::endl;
    if (g_engine) {
        g_engine->stop();
    }
    exit(signum);
}

int main(int argc, char* argv[]) {
    int port = 8080;
    if (argc > 1) {
        port = std::atoi(argv[1]);
    }

    // Register signal handlers for clean FD shutdown
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);

    std::cout << "===================================================" << std::endl;
    std::cout << "   C++ Core High-Concurrency Networking Engine    " << std::endl;
    std::cout << "===================================================" << std::endl;

    g_engine = std::make_unique<SocketEngine>(port, 8);
    if (!g_engine->start()) {
        std::cerr << "[Main]: Engine failed to start!" << std::endl;
        return 1;
    }

    return 0;
}
