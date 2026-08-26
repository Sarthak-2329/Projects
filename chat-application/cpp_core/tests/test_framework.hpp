#pragma once
// =============================================================================
// Minimal single-header test framework (no external dependencies)
// API surface is intentionally similar to Catch2 so tests are easy to migrate.
// =============================================================================

#include <iostream>
#include <string>
#include <vector>
#include <functional>
#include <stdexcept>
#include <sstream>

namespace tfw {

struct TestCase {
    std::string name;
    std::function<void()> fn;
};

inline std::vector<TestCase>& registry() {
    static std::vector<TestCase> cases;
    return cases;
}

inline int runAll() {
    int passed = 0, failed = 0;
    for (auto& tc : registry()) {
        std::cout << "  [TEST] " << tc.name << " ... ";
        try {
            tc.fn();
            std::cout << "PASS\n";
            ++passed;
        } catch (const std::exception& e) {
            std::cout << "FAIL\n         >> " << e.what() << "\n";
            ++failed;
        }
    }
    std::cout << "\n";
    if (failed == 0) {
        std::cout << "  All " << passed << " test(s) passed.\n";
    } else {
        std::cout << "  " << passed << " passed, " << failed << " FAILED.\n";
    }
    return (failed == 0) ? 0 : 1;
}

struct Registrar {
    Registrar(const char* name, std::function<void()> fn) {
        registry().push_back({name, fn});
    }
};

// Internal helpers for unique name generation
#define TFW_CONCAT_IMPL(a, b) a##b
#define TFW_CONCAT(a, b)      TFW_CONCAT_IMPL(a, b)

} // namespace tfw

// =============================================================================
// Public macros
// =============================================================================

/**
 * Defines a test case.  Usage:
 *   TEST_CASE("description") {
 *       REQUIRE(x == y);
 *   }
 */
#define TEST_CASE(name) \
    static void TFW_CONCAT(_tfw_fn_, __LINE__)(); \
    static tfw::Registrar TFW_CONCAT(_tfw_reg_, __LINE__)(name, TFW_CONCAT(_tfw_fn_, __LINE__)); \
    static void TFW_CONCAT(_tfw_fn_, __LINE__)()

/** Throws on failure — stops the current TEST_CASE immediately. */
#define REQUIRE(expr) \
    do { \
        if (!(expr)) { \
            std::ostringstream _oss; \
            _oss << "REQUIRE(" #expr ") failed at line " << __LINE__; \
            throw std::runtime_error(_oss.str()); \
        } \
    } while (0)

/** Alias for REQUIRE — stops the current test on failure. */
#define CHECK(expr) REQUIRE(expr)

#define REQUIRE_EQ(a, b) \
    do { \
        if (!((a) == (b))) { \
            std::ostringstream _oss; \
            _oss << "REQUIRE_EQ failed at line " << __LINE__ \
                 << ": left=" << (a) << " right=" << (b); \
            throw std::runtime_error(_oss.str()); \
        } \
    } while (0)

/** Entry point — place in exactly one .cpp file that includes this header. */
int main() {
    std::cout << "=== C++ Unit Tests ===\n\n";
    return tfw::runAll();
}
