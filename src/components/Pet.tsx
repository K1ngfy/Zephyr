import React, { useState, useEffect } from 'react';

const CapybaraSVG = ({ isRightSide }: { isRightSide: boolean }) => (
  <svg 
    viewBox="0 0 100 100" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ transform: isRightSide ? 'scaleX(1)' : 'scaleX(-1)' }}
    className="w-full h-full drop-shadow-xl filter transition-transform duration-300"
  >
    {/* Body */}
    <path d="M 40 20 C 80 20, 100 40, 100 80 L 100 100 L 15 100 C 5 100, 0 90, 0 70 C 0 40, 20 20, 40 20 Z" fill="#BC8A65" />
    
    {/* Belly/lower body shadow */}
    <path d="M 15 100 C 10 95, 10 85, 15 80 C 30 80, 70 80, 100 80 L 100 100 Z" fill="#9F6F4C" opacity="0.7" />

    {/* Ear */}
    <ellipse cx="50" cy="30" rx="8" ry="10" fill="#8F5E41" />
    <ellipse cx="48" cy="30" rx="4" ry="6" fill="#4B3123" />
    
    {/* Eye */}
    <circle cx="25" cy="45" r="4.5" fill="#3D2619" />
    <circle cx="24" cy="43.5" r="1.5" fill="#FFFFFF" />

    {/* Snout area */}
    <path d="M 0 70 C 0 55, 15 50, 30 50 C 35 70, 30 90, 10 90 C 5 90, 0 80, 0 70 Z" fill="#AA7955" />
    
    {/* Nose */}
    <path d="M 6 52 C 14 52, 16 58, 14 61 C 12 64, 6 66, 2 61 C 0 58, 2 52, 6 52 Z" fill="#3D2619" />
    
    {/* Mouth */}
    <path d="M 8 72 Q 18 80, 28 72" stroke="#3D2619" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    
    {/* Little Peeking Paw */}
    <path d="M 5 100 L 5 90 C 5 85, 15 85, 15 90 L 15 100" fill="#8F5E41" />
    <path d="M 8 90 L 8 100" stroke="#3D2619" strokeWidth="1" />
    <path d="M 12 90 L 12 100" stroke="#3D2619" strokeWidth="1" />

    {/* Blush */}
    <ellipse cx="35" cy="56" rx="7" ry="4.5" fill="#F4A7A7" opacity="0.7" />
  </svg>
);

export default function Pet({ ttsState, onClick, onCloseClick }: { ttsState: 'idle' | 'playing', onClick: () => void, onCloseClick?: () => void }) {
  // Postion initialized off-screen to avoid flash before effect
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const PET_WIDTH = 84;
  const PEEK_AMOUNT = 42; 

  useEffect(() => {
    // Dock to the right side vertically bottom on first load
    const startX = window.innerWidth - PEEK_AMOUNT;
    const startY = window.innerHeight - PET_WIDTH - 80;
    setPos({ x: startX, y: startY });

    const handleResize = () => {
      setPos(p => {
        if (p.x === -1) return p;
        // Snap to appropriate edge
        const newY = Math.min(p.y, window.innerHeight - PET_WIDTH);
        if (p.x >= window.innerWidth / 2) {
          return { x: window.innerWidth - PEEK_AMOUNT, y: newY };
        } else {
          return { x: -(PET_WIDTH - PEEK_AMOUNT), y: newY };
        }
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    
    const isRightSideStart = pos.x > window.innerWidth / 2;
    const startPos = { 
        x: isRightSideStart ? window.innerWidth - PEEK_AMOUNT : -(PET_WIDTH - PEEK_AMOUNT),
        y: pos.y 
    };

    let moved = false;
    setIsDragging(true);

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
      setIsDragging(false);
      
      if (!moved) {
        onClick();
      } else {
         // Snap
         setPos(p => {
             let newX = p.x;
             if (newX < window.innerWidth / 2) {
                 newX = -(PET_WIDTH - PEEK_AMOUNT);
             } else {
                 newX = window.innerWidth - PEEK_AMOUNT;
             }
             return { ...p, x: newX };
         });
      }
    };

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
  };

  const isHidden = pos.x < -PET_WIDTH || pos.x > window.innerWidth;
  if (pos.x === -1) return null;

  const isRightSide = pos.x > window.innerWidth / 2;
  
  // Calculate hover slide out logic
  let xOffset = 0;
  if (isHovered && !isDragging) {
      if (isRightSide) {
          xOffset = -15; // Slide left (out of right edge)
      } else {
          xOffset = 15; // Slide right (out of left edge)
      }
  }

  const positioningStyle = isDragging ? {
      left: pos.x,
      right: 'auto',
      top: pos.y,
  } : {
      top: pos.y,
      ...(isRightSide ? { right: -(PET_WIDTH - PEEK_AMOUNT), left: 'auto' } : { left: -(PET_WIDTH - PEEK_AMOUNT), right: 'auto' })
  };

  return (
    <div 
      className={`zephyr-pet-drag fixed flex flex-col items-center cursor-pointer transition-opacity select-none ${isHovered || isDragging ? 'opacity-100' : 'opacity-40'}`}
      style={{ 
        ...positioningStyle,
        width: PET_WIDTH, height: PET_WIDTH,
        zIndex: 2147483647, touchAction: 'none',
        transform: `translateX(${xOffset}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}
      onPointerDown={handlePointerDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CapybaraSVG isRightSide={isRightSide} />
      
      {onCloseClick && (
        <div 
          className={`absolute top-0 ${isRightSide ? 'left-0' : 'right-0'} w-6 h-6 bg-white shadow-md rounded-full flex items-center justify-center transition-opacity hover:bg-red-50 text-gray-400 hover:text-red-500 ${isHovered && !isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={(e) => {
            e.stopPropagation();
            onCloseClick();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
      )}

      {ttsState === 'playing' && (
        <div className={`absolute top-2 ${isRightSide ? 'left-2' : 'right-2'} flex gap-1 bg-[#1D1D1F]/80 p-1.5 rounded-full backdrop-blur-sm pointer-events-none`}>
           <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
           <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
           <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
}