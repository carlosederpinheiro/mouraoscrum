import React from 'react';

export function Logo({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) return <div className="text-xl font-black text-brand-accent">M.</div>;
  return (
    <div className="flex items-center gap-2">
      <img src="/logo_consultoria.png" alt="Mourão Consultoria" className="h-8 w-auto brightness-0 invert" />
    </div>
  );
}
