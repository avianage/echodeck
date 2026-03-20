export default function Loading() {
    return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
            {/* Pulsing logo */}
            <div className="relative">
                <div className="absolute inset-0 bg-blue-600/30 blur-3xl rounded-full animate-pulse" />
                <div className="relative w-16 h-16 bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
            <p className="text-gray-500 text-sm animate-pulse">Loading EchoDeck...</p>
        </div>
    );
}
