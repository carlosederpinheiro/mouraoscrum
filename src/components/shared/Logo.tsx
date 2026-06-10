import React from 'react';

import logoConsultoria from '../../assets/logo_consultoria.png';

export function Logo({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) return <div className="text-xl font-black text-brand-accent">M.</div>;
  return (
    <div className="flex items-center gap-2">
      <img src={logoConsultoria} alt="Mourão Consultoria" className="h-8 w-auto brightness-0 invert" />
    </div>
  );
}
