#include "../include/room_manager.hpp"
#include <cstring>

#ifdef _WIN32
  #include <winsock2.h>
#else
  #include <arpa/inet.h>
#endif


void RoomManager::addClient(int socketFd, const std::string& userId, const std::string& fullName, const std::string& roomId) {
    std::lock_guard<std::mutex> lock(managerMutex);
    sessions[socketFd] = ClientSession(socketFd, userId, fullName, roomId);
    if (!roomId.empty()) {
        roomToSockets[roomId].insert(socketFd);
    }
}

void RoomManager::removeClient(int socketFd) {
    std::lock_guard<std::mutex> lock(managerMutex);
    auto it = sessions.find(socketFd);
    if (it != sessions.end()) {
        const std::string& roomId = it->second.roomId;
        if (!roomId.empty()) {
            auto rIt = roomToSockets.find(roomId);
            if (rIt != roomToSockets.end()) {
                rIt->second.erase(socketFd);
                if (rIt->second.empty()) {
                    roomToSockets.erase(rIt);
                }
            }
        }
        sessions.erase(it);
    }
}

void RoomManager::updateHeartbeat(int socketFd) {
    std::lock_guard<std::mutex> lock(managerMutex);
    auto it = sessions.find(socketFd);
    if (it != sessions.end()) {
        it->second.lastHeartbeat = std::chrono::steady_clock::now();
    }
}

std::vector<int> RoomManager::checkTimeouts(int timeoutSeconds) {
    std::lock_guard<std::mutex> lock(managerMutex);
    std::vector<int> timedOutFds;
    auto now = std::chrono::steady_clock::now();

    for (const auto& [fd, session] : sessions) {
        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - session.lastHeartbeat).count();
        if (elapsed > timeoutSeconds) {
            timedOutFds.push_back(fd);
        }
    }
    return timedOutFds;
}

void RoomManager::joinRoom(int socketFd, const std::string& roomId) {
    std::lock_guard<std::mutex> lock(managerMutex);
    auto it = sessions.find(socketFd);
    if (it != sessions.end()) {
        // Remove from old room if present
        if (!it->second.roomId.empty()) {
            auto rIt = roomToSockets.find(it->second.roomId);
            if (rIt != roomToSockets.end()) {
                rIt->second.erase(socketFd);
                if (rIt->second.empty()) {
                    roomToSockets.erase(rIt);
                }
            }
        }
        it->second.roomId = roomId;
        roomToSockets[roomId].insert(socketFd);
    }
}

std::vector<int> RoomManager::getRoomSockets(const std::string& roomId) {
    std::lock_guard<std::mutex> lock(managerMutex);
    std::vector<int> result;
    auto it = roomToSockets.find(roomId);
    if (it != roomToSockets.end()) {
        result.assign(it->second.begin(), it->second.end());
    }
    return result;
}

bool RoomManager::getClient(int socketFd, ClientSession& outSession) {
    std::lock_guard<std::mutex> lock(managerMutex);
    auto it = sessions.find(socketFd);
    if (it != sessions.end()) {
        outSession = it->second;
        return true;
    }
    return false;
}

size_t RoomManager::getConnectedCount() {
    std::lock_guard<std::mutex> lock(managerMutex);
    return sessions.size();
}

std::vector<std::string> RoomManager::feedAndExtractFrames(int socketFd, const uint8_t* data, size_t len) {
    std::lock_guard<std::mutex> lock(managerMutex);
    std::vector<std::string> frames;
    auto it = sessions.find(socketFd);
    if (it == sessions.end()) return frames;
    
    auto& buf = it->second.readBuffer;
    buf.insert(buf.end(), data, data + len);
    
    while (buf.size() >= 4) {
        uint32_t payloadLength = 0;
        std::memcpy(&payloadLength, buf.data(), 4);
        payloadLength = ntohl(payloadLength);
        
        if (buf.size() < 4 + payloadLength) break;
        
        frames.emplace_back(reinterpret_cast<const char*>(buf.data() + 4), payloadLength);
        buf.erase(buf.begin(), buf.begin() + 4 + payloadLength);
    }
    return frames;
}
