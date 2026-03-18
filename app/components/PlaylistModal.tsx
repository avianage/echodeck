import { motion, AnimatePresence } from "framer-motion";
import { ListPlus, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface PlaylistModalProps {
    isOpen: boolean;
    title: string;
    videos: any[];
    onClose: () => void;
    onAddOne: (video: any) => void;
    onAddAll: () => void;
}

export function PlaylistModal({ isOpen, title, videos, onClose, onAddOne, onAddAll }: PlaylistModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                    >
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white truncate max-w-md">{title}</h2>
                                <p className="text-sm text-gray-400">{videos.length} videos found</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button onClick={onAddAll} className="bg-blue-600 font-bold rounded-xl">
                                    <ListPlus className="w-4 h-4 mr-2" /> Add All
                                </Button>
                                <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {videos.map((video: any, index: number) => (
                                <div key={`${video.id}-${index}`} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-transparent hover:border-gray-800 hover:bg-white/10 transition-all">
                                    <div className="w-24 h-14 relative flex-shrink-0">
                                        {video.thumbnail ? (
                                            <Image
                                                src={video.thumbnail}
                                                alt={video.title}
                                                fill
                                                className="rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gray-800 rounded-lg" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-white text-sm line-clamp-2">{video.title}</h4>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => onAddOne(video)} className="h-10 w-10 p-0 rounded-full text-gray-400">
                                        <Plus className="w-5 h-5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
