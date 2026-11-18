import { useState } from 'react';
import moose from '@/assets/moose.webp';

export function Moose({ say, className = '' }: { say?: string; className?: string }) {
  const [hops, setHops] = useState(0);
  return (
    <button type="button" aria-label="RAITTA" onClick={() => setHops((n) => n + 1)} className={`moose ${className}`}>
      <img key={hops} src={moose} alt="" width={932} height={1198} draggable={false} className={hops ? 'moose-hop' : ''} />
      <i className="moose-spark" />
      <i className="moose-spark" />
      <i className="moose-spark" />
      {say && (
        <span key={say} className="moose-bubble">
          {say}
        </span>
      )}
    </button>
  );
}
