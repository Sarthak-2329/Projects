/**
 * Unit tests for RoomManager (includes feedAndExtractFrames frame-parsing logic).
 *
 * Uses the minimal test_framework.hpp bundled with this project.
 * Run via:  bash cpp_core/tests/run_tests.sh
 */

#include "test_framework.hpp"
#include "../include/room_manager.hpp"

#ifdef _WIN32
  #include <winsock2.h>
#else
  #include <arpa/inet.h>   // htonl / ntohl
#endif

#include <cstring>   // memcpy
#include <thread>
#include <chrono>
#include <algorithm>  // std::find

// =============================================================================
// Frame helpers
// =============================================================================

/** Build a valid 4-byte-prefix frame for the given payload string. */
static std::vector<uint8_t> makeFrame(const std::string& payload) {
    uint32_t netLen = htonl(static_cast<uint32_t>(payload.size()));
    std::vector<uint8_t> frame(4 + payload.size());
    std::memcpy(frame.data(), &netLen, 4);
    std::memcpy(frame.data() + 4, payload.data(), payload.size());
    return frame;
}

// =============================================================================
// RoomManager — session management
// =============================================================================

TEST_CASE("RoomManager starts with zero connected clients") {
    RoomManager rm;
    REQUIRE_EQ(rm.getConnectedCount(), static_cast<size_t>(0));
}

TEST_CASE("addClient registers the session and inserts fd into the room") {
    RoomManager rm;
    rm.addClient(10, "user1", "Alice", "room-A");

    REQUIRE_EQ(rm.getConnectedCount(), static_cast<size_t>(1));

    auto sockets = rm.getRoomSockets("room-A");
    CHECK(sockets.size() == 1);
    CHECK(sockets[0] == 10);
}

TEST_CASE("addClient with empty roomId does not create a room entry") {
    RoomManager rm;
    rm.addClient(20, "user2", "Bob", "");

    REQUIRE_EQ(rm.getConnectedCount(), static_cast<size_t>(1));
    // Room "" should have no sockets (or empty vector)
    auto sockets = rm.getRoomSockets("");
    CHECK(sockets.empty());
}

TEST_CASE("getClient returns the correct session data") {
    RoomManager rm;
    rm.addClient(30, "uid-3", "Carol", "room-B");

    ClientSession session;
    bool found = rm.getClient(30, session);
    REQUIRE(found);
    REQUIRE(session.socketFd == 30);
    REQUIRE(session.userId   == "uid-3");
    REQUIRE(session.fullName == "Carol");
    REQUIRE(session.roomId   == "room-B");
}

TEST_CASE("getClient returns false for an unknown fd") {
    RoomManager rm;
    ClientSession session;
    CHECK(!rm.getClient(99, session));
}

TEST_CASE("removeClient decrements count and cleans up the room entry") {
    RoomManager rm;
    rm.addClient(40, "uid-4", "Dave", "room-C");
    rm.removeClient(40);

    REQUIRE_EQ(rm.getConnectedCount(), static_cast<size_t>(0));
    CHECK(rm.getRoomSockets("room-C").empty());
}

TEST_CASE("removeClient of non-existent fd is a no-op") {
    RoomManager rm;
    rm.addClient(50, "uid-5", "Eve", "room-D");
    rm.removeClient(999); // does not exist
    REQUIRE_EQ(rm.getConnectedCount(), static_cast<size_t>(1));
}

TEST_CASE("joinRoom moves the fd from old room to the new room") {
    RoomManager rm;
    rm.addClient(60, "uid-6", "Frank", "room-E");

    // Confirm it is in room-E
    auto socketsE = rm.getRoomSockets("room-E");
    REQUIRE(socketsE.size() == 1);

    rm.joinRoom(60, "room-F");

    auto socketsE2 = rm.getRoomSockets("room-E");
    auto socketsF  = rm.getRoomSockets("room-F");

    CHECK(socketsE2.empty());
    CHECK(socketsF.size() == 1);
    CHECK(socketsF[0] == 60);
}

TEST_CASE("getRoomSockets returns all fds registered in a room") {
    RoomManager rm;
    rm.addClient(70, "uid-7", "Grace", "room-G");
    rm.addClient(71, "uid-8", "Heidi", "room-G");
    rm.addClient(72, "uid-9", "Ivan",  "room-H");

    auto sG = rm.getRoomSockets("room-G");
    REQUIRE_EQ(sG.size(), static_cast<size_t>(2));

    bool has70 = std::find(sG.begin(), sG.end(), 70) != sG.end();
    bool has71 = std::find(sG.begin(), sG.end(), 71) != sG.end();
    CHECK(has70);
    CHECK(has71);

    auto sH = rm.getRoomSockets("room-H");
    REQUIRE_EQ(sH.size(), static_cast<size_t>(1));
    CHECK(sH[0] == 72);
}

TEST_CASE("checkTimeouts returns no fds immediately after addClient") {
    RoomManager rm;
    rm.addClient(80, "uid-10", "Judy", "room-I");

    // Default timeout is 30 seconds; no client should time out immediately
    auto timedOut = rm.checkTimeouts(30);
    CHECK(timedOut.empty());
}

// =============================================================================
// feedAndExtractFrames — TCP frame parsing (4-byte big-endian length prefix)
// =============================================================================

TEST_CASE("feedAndExtractFrames returns empty vector for unknown fd") {
    RoomManager rm;
    const uint8_t data[] = {0, 0, 0, 5, 'h', 'e', 'l', 'l', 'o'};
    auto frames = rm.feedAndExtractFrames(999, data, sizeof(data));
    CHECK(frames.empty());
}

TEST_CASE("feedAndExtractFrames extracts a single complete frame") {
    RoomManager rm;
    rm.addClient(100, "uid-f1", "Tester", "room-T");

    auto frame = makeFrame("hello");
    auto frames = rm.feedAndExtractFrames(100, frame.data(), frame.size());

    REQUIRE_EQ(frames.size(), static_cast<size_t>(1));
    CHECK(frames[0] == "hello");
}

TEST_CASE("feedAndExtractFrames extracts a zero-length payload frame") {
    RoomManager rm;
    rm.addClient(101, "uid-f2", "Tester", "room-T");

    auto frame = makeFrame("");
    auto frames = rm.feedAndExtractFrames(101, frame.data(), frame.size());

    REQUIRE_EQ(frames.size(), static_cast<size_t>(1));
    CHECK(frames[0].empty());
}

TEST_CASE("feedAndExtractFrames extracts two frames from a single buffer") {
    RoomManager rm;
    rm.addClient(102, "uid-f3", "Tester", "room-T");

    auto f1 = makeFrame("first");
    auto f2 = makeFrame("second");

    std::vector<uint8_t> combined;
    combined.insert(combined.end(), f1.begin(), f1.end());
    combined.insert(combined.end(), f2.begin(), f2.end());

    auto frames = rm.feedAndExtractFrames(102, combined.data(), combined.size());

    REQUIRE_EQ(frames.size(), static_cast<size_t>(2));
    CHECK(frames[0] == "first");
    CHECK(frames[1] == "second");
}

TEST_CASE("feedAndExtractFrames buffers a partial header and returns empty") {
    RoomManager rm;
    rm.addClient(103, "uid-f4", "Tester", "room-T");

    // Only 3 bytes — not enough for even the 4-byte header
    const uint8_t partial[] = {0, 0, 0};
    auto frames = rm.feedAndExtractFrames(103, partial, sizeof(partial));
    CHECK(frames.empty());
}

TEST_CASE("feedAndExtractFrames buffers a partial payload and delivers on second feed") {
    RoomManager rm;
    rm.addClient(104, "uid-f5", "Tester", "room-T");

    auto full = makeFrame("split-me");

    // Feed first half — expect no complete frames
    size_t half = full.size() / 2;
    auto frames1 = rm.feedAndExtractFrames(104, full.data(), half);
    CHECK(frames1.empty());

    // Feed second half — now the frame is complete
    auto frames2 = rm.feedAndExtractFrames(104, full.data() + half, full.size() - half);
    REQUIRE_EQ(frames2.size(), static_cast<size_t>(1));
    CHECK(frames2[0] == "split-me");
}

TEST_CASE("feedAndExtractFrames handles binary payload correctly") {
    RoomManager rm;
    rm.addClient(105, "uid-f6", "Tester", "room-T");

    // Payload with embedded null bytes and high bytes
    std::string payload = {'\x00', '\x01', '\xFF', '\xFE', 'A', 'B'};
    auto frame  = makeFrame(payload);
    auto frames = rm.feedAndExtractFrames(105, frame.data(), frame.size());

    REQUIRE_EQ(frames.size(), static_cast<size_t>(1));
    CHECK(frames[0] == payload);
}

TEST_CASE("feedAndExtractFrames rejects an oversized frame before buffering its payload") {
    RoomManager rm;
    rm.addClient(106, "uid-f7", "Tester", "room-T");

    const uint32_t oversizedLength = htonl(static_cast<uint32_t>(RoomManager::MAX_FRAME_SIZE + 1));
    uint8_t header[4];
    std::memcpy(header, &oversizedLength, sizeof(header));

    bool threw = false;
    try {
        rm.feedAndExtractFrames(106, header, sizeof(header));
    } catch (const std::runtime_error&) {
        threw = true;
    }

    CHECK(threw);
}
