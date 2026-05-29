import React, { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';

export default function Pet({ ttsState, onClick }: { ttsState: 'idle' | 'playing', onClick: () => void }) {
  // Postion initialized off-screen to avoid flash before effect
  const [pos, setPos] = useState({ x: -1, y: -1 });

  useEffect(() => {
    // Dock to the right side vertically centered on first load
    const startX = window.innerWidth - 32; // Half size inside, half outside possibly, or just at the edge
    const startY = window.innerHeight / 2 - 32;
    setPos({ x: startX, y: startY });
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...pos };

    let moved = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      moved = true;
      setPos({
        x: startPos.x + (moveEvent.clientX - startX),
        y: startPos.y + (moveEvent.clientY - startY)
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      el.releasePointerCapture(upEvent.pointerId);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      
      if (!moved) {
        onClick();
      } else {
         // Snap
         setPos(p => {
             let newX = p.x;
             if (newX < window.innerWidth / 2) {
                 newX = -32;
             } else {
                 newX = window.innerWidth - 32;
             }
             return { ...p, x: newX };
         });
      }
    };

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
  };

  const isHidden = pos.x < 0 || pos.x > window.innerWidth - 64;

  if (pos.x === -1) return null;

  return (
    <div 
      className={`zephyr-pet-drag fixed w-16 h-16 bg-[#1D1D1F] rounded-full shadow-2xl shadow-black/20 flex items-center justify-center cursor-pointer ring-4 ring-white transition-opacity select-none ${isHidden ? 'opacity-50' : 'opacity-100'}`}
      style={{ left: pos.x, top: pos.y, zIndex: 2147483647, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
    >
      <Sparkles className="w-7 h-7 text-white" />
      {ttsState === 'playing' && (
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#1D1D1F] animate-pulse" />
      )}
    </div>
  );
}