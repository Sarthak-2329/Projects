#include "../include/room_manager.hpp"

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
            roomToSockets[it->second.roomId].erase(socketFd);
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
