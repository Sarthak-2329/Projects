#ifndef SOCKET_ENGINE_HPP
#define SOCKET_ENGINE_HPP

#include <iostream>
#include <string>
#include <vector>
#include <cstring>
#include <atomic>
#include <memory>
#include <chrono>

#ifdef _WIN32
  #include <winsock2.h>
  #include <ws2tcpip.h>
  #pragma comment(lib, "ws2_32.lib")
  typedef SOCKET socket_t;
  #define IS_VALIDSOCKET(s) ((s) != INVALID_SOCKET)
  #define CLOSESOCKET(s) closesocket(s)
#else
  #include <sys/types.h>
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <arpa/inet.h>
  #include <unistd.h>
  #include <fcntl.h>
  #include <signal.h>
  #ifdef __linux__
    #include <sys/epoll.h>
  #endif
  typedef int socket_t;
  #define INVALID_SOCKET (-1)
  #define IS_VALIDSOCKET(s) ((s) >= 0)
  #define CLOSESOCKET(s) close(s)
#endif

#include "thread_pool.hpp"
#include "room_manager.hpp"

/**
 * @brief High-concurrency C++ TCP Socket Engine supporting epoll I/O multiplexing
 * with custom 4-byte prefix packet framing and thread pool job distribution.
 */
class SocketEngine {
public:
    SocketEngine(int port, size_t threadPoolSize = 4);
    ~SocketEngine();

    // Start network engine & event loop
    bool start();

    // Stop engine & clean up resources
    void stop();

    // Broadcast message frame to room sockets with 4-byte length prefix
    bool broadcastToRoom(const std::string& roomId, const std::string& payload);

    // Send framed packet to a specific socket
    bool sendFramed(socket_t clientFd, const std::string& payload);

private:
    int port;
    socket_t listenFd;
    std::atomic<bool> isRunning;
    
    std::unique_ptr<ThreadPool> threadPool;
    std::unique_ptr<RoomManager> roomManager;

    // Epoll handle (Linux) or Polling loop (Cross-platform)
    int epollFd;

    void initializePlatformSockets();
    void cleanupPlatformSockets();
    bool setNonBlocking(socket_t fd);
    void eventLoop();

    void handleIncomingConnection();
    void handleClientData(socket_t clientFd);
    void processPacketPayload(socket_t clientFd, const std::string& payload);
    void heartbeatRoutine();
};

#endif // SOCKET_ENGINE_HPP
