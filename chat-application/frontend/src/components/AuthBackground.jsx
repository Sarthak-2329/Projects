function AuthBackground({ children }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-oat">
      {/* Subtle warm ink texture blobs — much softer than the old dark glows */}
      <div className="absolute w-[520px] h-[520px] bg-ochre/10 rounded-full blur-[140px] top-[-100px] left-[-160px] pointer-events-none" />
      <div className="absolute w-[420px] h-[420px] bg-forest/8 rounded-full blur-[120px] bottom-[-130px] right-[-100px] pointer-events-none" />
      <div className="absolute w-[320px] h-[320px] bg-rust/6 rounded-full blur-[110px] bottom-[100px] left-[35%] pointer-events-none" />
      {children}
    </div>
  );
}

export default AuthBackground;