function BorderAnimatedContainer({ children }) {
  return (
    <div
      className="w-full h-full rounded-2xl border border-ink/12 shadow-[0_4px_40px_rgba(43,38,32,0.08)] overflow-hidden flex"
      style={{ background: "#F7F3EA" }}
    >
      {children}
    </div>
  );
}

export default BorderAnimatedContainer;