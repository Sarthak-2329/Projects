#include "../include/socket_engine.hpp"

#define MAX_EVENTS 64
#define BUFFER_SIZE 4096

SocketEngine::SocketEngine(int p, size_t threadPoolSize)
    : port(p), listenFd(INVALID_SOCKET), isRunning(false), epollFd(-1) {
    initializePlatformSockets();
    threadPool = std::make_unique<ThreadPool>(threadPoolSize);
    roomManager = std::make_unique<RoomManager>();
}

SocketEngine::~SocketEngine() {
    stop();
    cleanupPlatformSockets();
}

void SocketEngine::initializePlatformSockets() {
#ifdef _WIN32
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);
#endif
}

void SocketEngine::cleanupPlatformSockets() {
#ifdef _WIN32
    WSACleanup();
#endif
}

bool SocketEngine::setNonBlocking(socket_t fd) {
#ifdef _WIN32
    u_long mode = 1;
    return ioctlsocket(fd, FIONBIO, &mode) == 0;
#else
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags == -1) return false;
    return fcntl(fd, F_SETFL, flags | O_NONBLOCK) == 0;
#endif
}

bool SocketEngine::start() {
    listenFd = socket(AF_INET, SOCK_STREAM, 0);
    if (!IS_VALIDSOCKET(listenFd)) {
        std::cerr << "[SocketEngine Error]: Failed to create listening socket" << std::endl;
        return false;
    }

    int opt = 1;
    setsockopt(listenFd, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

    sockaddr_in serverAddr{};
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(port);

    if (bind(listenFd, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) < 0) {
        std::cerr << "[SocketEngine Error]: Bind failed on port " << port << std::endl;
        CLOSESOCKET(listenFd);
        return false;
    }

    if (listen(listenFd, SOMAXCONN) < 0) {
        std::cerr << "[SocketEngine Error]: Listen failed" << std::endl;
        CLOSESOCKET(listenFd);
        return false;
    }

    setNonBlocking(listenFd);

#if defined(__linux__)
    epollFd = epoll_create1(0);
    if (epollFd == -1) {
        std::cerr << "[SocketEngine Error]: epoll_create1 failed" << std::endl;
        CLOSESOCKET(listenFd);
        return false;
    }

    struct epoll_event ev{};
    ev.events = EPOLLIN | EPOLLET; // Edge-triggered IO multiplexing
    ev.data.fd = listenFd;
    if (epoll_ctl(epollFd, EPOLL_CTL_ADD, listenFd, &ev) == -1) {
        std::cerr << "[SocketEngine Error]: epoll_ctl failed for listening socket" << std::endl;
        close(epollFd);
        CLOSESOCKET(listenFd);
        return false;
    }
#endif

    isRunning = true;
    std::cout << "[SocketEngine]: Server initialized and listening on port " << port << "..." << std::endl;

    // Start background heartbeat task
    threadPool->enqueue([this]() { this->heartbeatRoutine(); });

    // Main network loop
    eventLoop();
    return true;
}

void SocketEngine::eventLoop() {
#if defined(__linux__)
    struct epoll_event events[MAX_EVENTS];
    while (isRunning) {
        int nfds = epoll_wait(epollFd, events, MAX_EVENTS, 500); // 500ms timeout
        for (int i = 0; i < nfds; ++i) {
            int fd = events[i].data.fd;
            if (fd == listenFd) {
                handleIncomingConnection();
            } else if (events[i].events & (EPOLLHUP | EPOLLERR)) {
                roomManager->removeClient(fd);
                epoll_ctl(epollFd, EPOLL_CTL_DEL, fd, nullptr);
                CLOSESOCKET(fd);
            } else if (events[i].events & EPOLLIN) {
                threadPool->enqueue([this, fd]() {
                    this->handleClientData(fd);
                });
            }
        }
    }
#else
    // Windows / Cross-platform fallback poll loop
    while (isRunning) {
        fd_set readFds;
        FD_ZERO(&readFds);
        FD_SET(listenFd, &readFds);

        timeval tv{ 0, 500000 }; // 500ms
        int activity = select((int)listenFd + 1, &readFds, nullptr, nullptr, &tv);

        if (activity > 0 && FD_ISSET(listenFd, &readFds)) {
            handleIncomingConnection();
        }
    }
#endif
}

void SocketEngine::handleIncomingConnection() {
    sockaddr_in clientAddr{};
    socklen_t addrLen = sizeof(clientAddr);
    socket_t clientFd = accept(listenFd, (struct sockaddr*)&clientAddr, &addrLen);

    if (IS_VALIDSOCKET(clientFd)) {
        setNonBlocking(clientFd);

#if defined(__linux__)
        struct epoll_event ev{};
        ev.events = EPOLLIN | EPOLLET | EPOLLONESHOT;
        ev.data.fd = clientFd;
        epoll_ctl(epollFd, EPOLL_CTL_ADD, clientFd, &ev);
#endif

        char ipStr[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &(clientAddr.sin_addr), ipStr, INET_ADDRSTRLEN);
        std::cout << "[SocketEngine]: New client connected from " << ipStr << " (fd: " << clientFd << ")" << std::endl;

        roomManager->addClient(clientFd, "", "Anonymous", "default");
    }
}

void SocketEngine::handleClientData(socket_t clientFd) {
    uint8_t buffer[BUFFER_SIZE];
    int bytesRead = recv(clientFd, (char*)buffer, sizeof(buffer), 0);

    if (bytesRead <= 0) {
        // Disconnected or socket error
        std::cout << "[SocketEngine]: Client disconnected (fd: " << clientFd << ")" << std::endl;
        roomManager->removeClient(clientFd);
#if defined(__linux__)
        epoll_ctl(epollFd, EPOLL_CTL_DEL, clientFd, nullptr);
#endif
        CLOSESOCKET(clientFd);
        return;
    }

    roomManager->updateHeartbeat(clientFd);

    // Read buffer assembly & custom 4-byte length prefix framing parser
    ClientSession session;
    if (roomManager->getClient(clientFd, session)) {
        session.readBuffer.insert(session.readBuffer.end(), buffer, buffer + bytesRead);

        while (session.readBuffer.size() >= 4) {
            uint32_t payloadLength = 0;
            std::memcpy(&payloadLength, session.readBuffer.data(), 4);
            payloadLength = ntohl(payloadLength);

            if (session.readBuffer.size() < 4 + payloadLength) {
                // Partial frame received, wait for next buffer chunk
                break;
            }

            // Full packet frame extracted
            std::string payload((char*)session.readBuffer.data() + 4, payloadLength);
            session.readBuffer.erase(session.readBuffer.begin(), session.readBuffer.begin() + 4 + payloadLength);

            processPacketPayload(clientFd, payload);
        }
    }

#if defined(__linux__)
    // Re-arm epoll ONESHOT flag
    struct epoll_event ev{};
    ev.events = EPOLLIN | EPOLLET | EPOLLONESHOT;
    ev.data.fd = clientFd;
    epoll_ctl(epollFd, EPOLL_CTL_MOD, clientFd, &ev);
#endif
}

void SocketEngine::processPacketPayload(socket_t clientFd, const std::string& payload) {
    std::cout << "[Packet Received fd " << clientFd << "]: " << payload << std::endl;

    // Simple protocol commands check
    if (payload.find("\"type\":\"PING\"") != std::string::npos) {
        std::string pong = "{\"type\":\"PONG\"}";
        sendFramed(clientFd, pong);
    } else if (payload.find("\"type\":\"JOIN\"") != std::string::npos) {
        roomManager->joinRoom(clientFd, "main_room");
        std::string ack = "{\"type\":\"JOIN_ACK\",\"room\":\"main_room\"}";
        sendFramed(clientFd, ack);
    } else {
        // Echo / Broadcast frame to room
        broadcastToRoom("main_room", payload);
    }
}

bool SocketEngine::sendFramed(socket_t clientFd, const std::string& payload) {
    uint32_t payloadLen = htonl(static_cast<uint32_t>(payload.size()));
    std::vector<uint8_t> frame(4 + payload.size());
    std::memcpy(frame.data(), &payloadLen, 4);
    std::memcpy(frame.data() + 4, payload.data(), payload.size());

    int totalSent = 0;
    int toSend = static_cast<int>(frame.size());

    while (totalSent < toSend) {
        int sent = send(clientFd, (const char*)frame.data() + totalSent, toSend - totalSent, 0);
        if (sent <= 0) return false;
        totalSent += sent;
    }
    return true;
}

bool SocketEngine::broadcastToRoom(const std::string& roomId, const std::string& payload) {
    std::vector<int> sockets = roomManager->getRoomSockets(roomId);
    for (int fd : sockets) {
        sendFramed(fd, payload);
    }
    return true;
}

void SocketEngine::heartbeatRoutine() {
    while (isRunning) {
        std::this_thread::sleep_for(std::chrono::seconds(15));
        if (!isRunning) break;

        std::vector<int> timedOutFds = roomManager->checkTimeouts(30);
        for (int fd : timedOutFds) {
            std::cout << "[SocketEngine Heartbeat]: Timing out inactive client fd " << fd << std::endl;
            roomManager->removeClient(fd);
#if defined(__linux__)
            epoll_ctl(epollFd, EPOLL_CTL_DEL, fd, nullptr);
#endif
            CLOSESOCKET(fd);
        }
    }
}

void SocketEngine::stop() {
    if (!isRunning) return;
    isRunning = false;

    if (IS_VALIDSOCKET(listenFd)) {
        CLOSESOCKET(listenFd);
        listenFd = INVALID_SOCKET;
    }

#if defined(__linux__)
    if (epollFd != -1) {
        close(epollFd);
        epollFd = -1;
    }
#endif
    std::cout << "[SocketEngine]: Stopped successfully." << std::endl;
}
