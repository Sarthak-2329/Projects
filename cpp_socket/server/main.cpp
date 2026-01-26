#define _WIN32_WINNT 0x0600
#include<WinSock2.h>
#include<WS2tcpip.h>
#include<iostream>
#pragma comment(lib,"ws2_32.lib")
using namespace std;

bool Initialize(){
    WSADATA data;
    return WSAStartup(MAKEWORD(2,2),&data)==0;
}

int main(){
    if(!Initialize()){
        cout<<"WinSock initialization failed."<<endl;
        return 1;
    }
    cout<<"Server Program:"<<endl;

    SOCKET listenSocket = socket(AF_INET,SOCK_STREAM,0);
    if(listenSocket==INVALID_SOCKET){
        cout<<"Socket creation failed."<<endl;
        return 1;
    }

    // create address structure
    sockaddr_in serveraddr;
    serveraddr.sin_family = AF_INET;
    serveraddr.sin_port = htons(12345);

    // convert the ipaddress (0.0.0.0) put it inside the sin_family in binary form

    if (inet_pton(AF_INET,"0.0.0.0",&serveraddr.sin_addr)!=1)
    {
        cout<<"Setting address structure failed."<<endl;
        return 1;
    }
    

    WSACleanup();
    return 0;
}