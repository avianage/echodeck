export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-gray-950 px-4 md:px-12 pt-6 animate-pulse">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-gray-800 rounded-xl" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-900 rounded-xl border border-gray-800" />
          ))}
        </div>
      </div>
    </div>
  );
}
