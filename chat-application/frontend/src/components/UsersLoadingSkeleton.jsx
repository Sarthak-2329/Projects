function UsersLoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((item) => (
        <div key={item} className="bg-ink/5 p-4 rounded-lg animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-ink/10 rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-ink/10 rounded w-3/4 mb-2" />
              <div className="h-3 bg-ink/8 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default UsersLoadingSkeleton;