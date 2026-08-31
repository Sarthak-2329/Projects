#ifndef ROOM_MANAGER_HPP
#define ROOM_MANAGER_HPP

#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <mutex>
#include <chrono>
#include <iostream>
#include <memory>
#include <cstdint>
#include <stdexcept>

struct ClientSession {
    int socketFd;
    std::string userId;
    std::string fullName;
    std::string roomId;
    std::chrono::steady_clock::time_point lastHeartbeat;
    std::vector<uint8_t> readBuffer;

    ClientSession(int fd = -1, std::string uId = "", std::string name = "", std::string rId = "")
        : socketFd(fd), userId(uId), fullName(name), roomId(rId),
          lastHeartbeat(std::chrono::steady_clock::now()) {}
};

/**
 * @brief Thread-safe manager for chat rooms and client active socket sessions.
 */
class RoomManager {
public:
    static constexpr size_t MAX_FRAME_SIZE = 1024 * 1024;
    static constexpr size_t MAX_BUFFER_SIZE = 2 * MAX_FRAME_SIZE;
    RoomManager() = default;
    ~RoomManager() = default;

    // Register or update client session
    void addClient(int socketFd, const std::string& userId, const std::string& fullName, const std::string& roomId);
    
    // Remove client session
    void removeClient(int socketFd);

    // Update heartbeat timestamp for a socket
    void updateHeartbeat(int socketFd);

    // Get list of timed out socket file descriptors
    std::vector<int> checkTimeouts(int timeoutSeconds = 30);

    // Join room
    void joinRoom(int socketFd, const std::string& roomId);

    // Get sockets in room
    std::vector<int> getRoomSockets(const std::string& roomId);

    // Get client info
    bool getClient(int socketFd, ClientSession& outSession);

    // Atomically append data to client's readBuffer and extract complete frames
    std::vector<std::string> feedAndExtractFrames(int socketFd, const uint8_t* data, size_t len);

    // Total connected clients count
    size_t getConnectedCount();

    // Snapshot of active client sockets, used for orderly engine shutdown.
    std::vector<int> getConnectedSockets();

private:
    std::mutex managerMutex;
    std::unordered_map<int, ClientSession> sessions; // socketFd -> ClientSession
    std::unordered_map<std::string, std::unordered_set<int>> roomToSockets; // roomId -> set of socketFds
};

#endif // ROOM_MANAGER_HPP
