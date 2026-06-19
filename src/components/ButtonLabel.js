import React from 'react';

export function ButtonLabel({ icon: Icon, children, iconClassName = 'w-4 h-4 shrink-0' }) {
  return (
    <>
      {Icon ? <Icon className={iconClassName} /> : null}
      <span>{children}</span>
    </>
  );
}
