export default function DiscoverLoading() {
    return (
        <div className="min-h-screen bg-gray-950 px-4 md:px-12 lg:px-20 pt-6 animate-pulse">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="h-10 w-64 bg-gray-800 rounded-xl" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
                            <div className="aspect-video bg-gray-800" />
                            <div className="p-4 space-y-3">
                                <div className="h-4 bg-gray-800 rounded w-3/4" />
                                <div className="h-3 bg-gray-800 rounded w-1/2" />
                                <div className="h-8 bg-gray-800 rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
