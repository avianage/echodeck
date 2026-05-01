'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface WindowControlsOverlayGeometryChangeEvent extends Event {
  readonly visible: boolean;
  readonly titlebarAreaRect: DOMRect;
}

export function WindowsTitleBar() {
  const [isOverlay, setIsOverlay] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'windowControlsOverlay' in navigator) {
      // @ts-expect-error - navigator.windowControlsOverlay is a newer API
      setTimeout(() => setIsOverlay(navigator.windowControlsOverlay.visible), 0);

      // @ts-expect-error - navigator.windowControlsOverlay is a newer API
      navigator.windowControlsOverlay.addEventListener(
        'geometrychange',
        (e: WindowControlsOverlayGeometryChangeEvent) => {
          setIsOverlay(e.visible);
        },
      );
    }
  }, []);

  if (!isOverlay) return null;

  return (
    <div className="titlebar-container bg-black/80 backdrop-blur-md flex items-center px-4 z-[9999] border-b border-white/5">
      <div className="titlebar-content flex items-center gap-3">
        <Image src="/logo.png" alt="EchoDeck" width={20} height={20} priority className="rounded" />
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">EchoDeck</span>
        <span className="text-[10px] text-gray-600 ml-2 hidden sm:inline">Desktop Experience</span>
      </div>
    </div>
  );
}
