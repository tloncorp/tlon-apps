import React, { useContext } from 'react';

export interface VirtualContextProps {
  save: () => void;
  restore: () => void;
}
const fallback: VirtualContextProps = {
  save: () => {
    // placeholder
  },
  restore: () => {
    // placeholder
  },
};

export const VirtualContext = React.createContext(fallback);

export function useVirtual() {
  return useContext(VirtualContext);
}
