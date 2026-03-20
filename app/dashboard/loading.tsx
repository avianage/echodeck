export default function DashboardLoading() {
    return (
        <div className="min-h-screen bg-gray-950 px-3 sm:px-6 md:px-12 lg:px-20 pt-6">
            {/* Skeleton for dashboard */}
            <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
                <div className="h-10 w-48 bg-gray-800 rounded-xl" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="h-[450px] bg-gray-900 rounded-2xl" />
                        <div className="h-12 bg-gray-900 rounded-xl" />
                    </div>
                    <div className="space-y-4">
                        <div className="h-8 w-32 bg-gray-800 rounded-xl" />
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-16 bg-gray-900 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
