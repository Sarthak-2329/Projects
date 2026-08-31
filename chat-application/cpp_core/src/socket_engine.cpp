#include "../include/socket_engine.hpp"
#include "json.hpp"

#include <cerrno>

extern volatile sig_atomic_t g_running;

#define MAX_EVENTS 64
#define BUFFER_SIZE 4096

SocketEngine::SocketEngine(int p)
    : port(p), listenFd(INVALID_SOCKET), isRunning(false), epollFd(-1) {
    initializePlatformSockets();
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

    // Main network loop
    eventLoop();
    return true;
}

void SocketEngine::eventLoop() {
#if defined(__linux__)
    struct epoll_event events[MAX_EVENTS];
    auto nextHeartbeatSweep = std::chrono::steady_clock::now() + std::chrono::seconds(15);
    while (isRunning && g_running) {
        int nfds = epoll_wait(epollFd, events, MAX_EVENTS, 500); // 500ms timeout
        if (nfds < 0) {
            if (errno == EINTR) continue;
            std::cerr << "[SocketEngine Error]: epoll_wait failed" << std::endl;
            break;
        }
        for (int i = 0; i < nfds; ++i) {
            int fd = events[i].data.fd;
            if (fd == listenFd) {
                handleIncomingConnection();
            } else if (events[i].events & (EPOLLHUP | EPOLLERR)) {
                closeClient(fd);
            } else {
                if (events[i].events & EPOLLIN) handleClientData(fd);
                if (events[i].events & EPOLLOUT) flushPendingWrites(fd);
            }
        }

        if (std::chrono::steady_clock::now() >= nextHeartbeatSweep) {
            for (int fd : roomManager->getConnectedSockets()) {
                sendFramed(fd, R"({"type":"PING"})");
            }
            for (int fd : roomManager->checkTimeouts(30)) {
                std::cout << "[SocketEngine Heartbeat]: Timing out inactive client fd " << fd << std::endl;
                closeClient(fd);
            }
            nextHeartbeatSweep = std::chrono::steady_clock::now() + std::chrono::seconds(15);
        }
    }
#else
    // Windows / Cross-platform fallback poll loop
    while (isRunning && g_running) {
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
    while (true) {
        sockaddr_in clientAddr{};
        socklen_t addrLen = sizeof(clientAddr);
        socket_t clientFd = accept(listenFd, (struct sockaddr*)&clientAddr, &addrLen);

        if (!IS_VALIDSOCKET(clientFd)) {
#ifdef _WIN32
            if (WSAGetLastError() == WSAEWOULDBLOCK) break;
#else
            if (errno == EAGAIN || errno == EWOULDBLOCK) break;
#endif
            break; // Other error
        }

        setNonBlocking(clientFd);

#if defined(__linux__)
        struct epoll_event ev{};
        ev.events = EPOLLIN | EPOLLET;
        ev.data.fd = clientFd;
        if (epoll_ctl(epollFd, EPOLL_CTL_ADD, clientFd, &ev) == -1) {
            std::cerr << "[SocketEngine Error]: epoll_ctl failed for client socket" << std::endl;
            CLOSESOCKET(clientFd);
            continue;
        }
#endif

        char ipStr[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &(clientAddr.sin_addr), ipStr, INET_ADDRSTRLEN);
        std::cout << "[SocketEngine]: New client connected from " << ipStr << " (fd: " << clientFd << ")" << std::endl;

        roomManager->addClient(clientFd, "", "Anonymous", "default");
    }
}

void SocketEngine::handleClientData(socket_t clientFd) {
    uint8_t buffer[BUFFER_SIZE];
    bool clientDisconnected = false;

    while (true) {
        int bytesRead = recv(clientFd, (char*)buffer, sizeof(buffer), 0);

        if (bytesRead > 0) {
            roomManager->updateHeartbeat(clientFd);
            try {
                auto frames = roomManager->feedAndExtractFrames(clientFd, buffer, bytesRead);
                for (const auto& payload : frames) {
                    processPacketPayload(clientFd, payload);
                }
            } catch (const std::exception& err) {
                std::cerr << "[SocketEngine]: Closing fd " << clientFd << ": " << err.what() << std::endl;
                clientDisconnected = true;
                break;
            }
        } else if (bytesRead == 0) {
            // Connection gracefully closed by client
            clientDisconnected = true;
            break;
        } else {
#ifdef _WIN32
            int err = WSAGetLastError();
            if (err == WSAEWOULDBLOCK) break;
#else
            if (errno == EAGAIN || errno == EWOULDBLOCK) break;
#endif
            // Socket error / connection reset
            clientDisconnected = true;
            break;
        }
    }

    if (clientDisconnected) {
        std::cout << "[SocketEngine]: Client disconnected (fd: " << clientFd << ")" << std::endl;
        closeClient(clientFd);
        return;
    }
}

void SocketEngine::processPacketPayload(socket_t clientFd, const std::string& payload) {
    std::cout << "[Packet Received fd " << clientFd << "]: " << payload << std::endl;

    try {
        auto packet = nlohmann::json::parse(payload);
        std::string type = packet.value("type", "");

        if (type == "PING") {
            sendFramed(clientFd, R"({"type":"PONG"})");
        } else if (type == "PONG") {
            // Receiving any data already refreshed the session heartbeat.
        } else if (type == "JOIN") {
            std::string room = packet.value("room", "default");
            roomManager->joinRoom(clientFd, room);
            nlohmann::json ack = {{"type", "JOIN_ACK"}, {"room", room}};
            sendFramed(clientFd, ack.dump());
        } else if (type == "MSG") {
            // Look up sender's room and broadcast
            ClientSession session;
            std::string targetRoom = "default";
            if (roomManager->getClient(clientFd, session) && !session.roomId.empty()) {
                targetRoom = session.roomId;
            }
            broadcastToRoom(targetRoom, payload);
        } else {
            // Unknown type — broadcast to sender's room as fallback
            ClientSession session;
            std::string targetRoom = "default";
            if (roomManager->getClient(clientFd, session) && !session.roomId.empty()) {
                targetRoom = session.roomId;
            }
            broadcastToRoom(targetRoom, payload);
        }
    } catch (const std::exception& e) {
        std::cerr << "[SocketEngine]: Invalid packet from fd " << clientFd << ": " << e.what() << std::endl;
    }
}

bool SocketEngine::sendFramed(socket_t clientFd, const std::string& payload) {
    constexpr size_t MAX_PENDING_WRITE_BYTES = 4 * 1024 * 1024;
    if (payload.size() > RoomManager::MAX_FRAME_SIZE) return false;

    uint32_t payloadLen = htonl(static_cast<uint32_t>(payload.size()));
    std::vector<uint8_t> frame(4 + payload.size());
    std::memcpy(frame.data(), &payloadLen, 4);
    std::memcpy(frame.data() + 4, payload.data(), payload.size());

    auto& pending = pendingWrites[clientFd];
    if (pending.size() + frame.size() > MAX_PENDING_WRITE_BYTES) {
        closeClient(clientFd);
        return false;
    }
    pending.insert(pending.end(), frame.begin(), frame.end());
    return flushPendingWrites(clientFd);
}

bool SocketEngine::flushPendingWrites(socket_t clientFd) {
    auto pendingIt = pendingWrites.find(clientFd);
    if (pendingIt == pendingWrites.end()) return true;

    auto& pending = pendingIt->second;
    while (!pending.empty()) {
#ifdef _WIN32
        int sent = send(clientFd, reinterpret_cast<const char*>(pending.data()), static_cast<int>(pending.size()), 0);
#else
        int sent = send(clientFd, pending.data(), pending.size(), MSG_NOSIGNAL);
#endif
        if (sent > 0) {
            pending.erase(pending.begin(), pending.begin() + sent);
            continue;
        }
        if (sent < 0) {
#ifdef _WIN32
            if (WSAGetLastError() == WSAEWOULDBLOCK) {
#else
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
#endif
                updateClientEvents(clientFd);
                return true;
            }
#ifndef _WIN32
            if (errno == EINTR) continue;
#endif
        }
        closeClient(clientFd);
        return false;
    }

    pendingWrites.erase(pendingIt);
    updateClientEvents(clientFd);
    return true;
}

void SocketEngine::updateClientEvents(socket_t clientFd) {
#if defined(__linux__)
    if (epollFd == -1) return;
    struct epoll_event ev{};
    ev.events = EPOLLIN | EPOLLET;
    if (pendingWrites.find(clientFd) != pendingWrites.end()) ev.events |= EPOLLOUT;
    ev.data.fd = clientFd;
    epoll_ctl(epollFd, EPOLL_CTL_MOD, clientFd, &ev);
#else
    (void)clientFd;
#endif
}

void SocketEngine::closeClient(socket_t clientFd) {
    ClientSession session;
    if (!roomManager->getClient(clientFd, session)) return;

    pendingWrites.erase(clientFd);
    roomManager->removeClient(clientFd);
#if defined(__linux__)
    if (epollFd != -1) epoll_ctl(epollFd, EPOLL_CTL_DEL, clientFd, nullptr);
#endif
    CLOSESOCKET(clientFd);
}

bool SocketEngine::broadcastToRoom(const std::string& roomId, const std::string& payload) {
    std::vector<int> sockets = roomManager->getRoomSockets(roomId);
    for (int fd : sockets) {
        sendFramed(fd, payload);
    }
    return true;
}

void SocketEngine::stop() {
    if (!isRunning) return;
    isRunning = false;

    for (int clientFd : roomManager->getConnectedSockets()) {
        closeClient(clientFd);
    }

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
