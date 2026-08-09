cmake_minimum_required(VERSION 3.14)
project(CppChatCoreEngine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

file(GLOB SOURCES 
    "src/*.cpp"
)

add_executable(cpp_chat_core ${SOURCES})

if(WIN32)
    target_link_libraries(cpp_chat_core PRIVATE ws2_32)
else()
    target_link_libraries(cpp_chat_core PRIVATE pthread)
endif()
