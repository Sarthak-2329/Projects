import React from "react";

function AuthBackground({ children }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#0b132b] to-[#020617]">

      {/* glowing blobs */}
      <div className="absolute w-[420px] h-[420px] bg-cyan-500/30 rounded-full blur-[120px] top-[-80px] left-[-120px] animate-pulse"></div>

      <div className="absolute w-[380px] h-[380px] bg-purple-500/30 rounded-full blur-[120px] bottom-[-120px] right-[-80px] animate-pulse"></div>

      <div className="absolute w-[300px] h-[300px] bg-blue-500/30 rounded-full blur-[100px] bottom-[120px] left-[30%] animate-pulse"></div>

      {children}

    </div>
  );
}

export default AuthBackground;