function MessagesLoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {[...Array(6)].map((_, index) => (
        <div
          key={index}
          className={`flex w-full ${index % 2 === 0 ? "justify-start" : "justify-end"} animate-pulse`}
        >
          <div
            className={`bg-ink/8 w-32 h-12 rounded-2xl ${
              index % 2 === 0 ? "rounded-bl-sm" : "rounded-br-sm"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

export default MessagesLoadingSkeleton;