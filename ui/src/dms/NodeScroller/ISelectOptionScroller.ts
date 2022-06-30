import React from 'react';
import { IShipOptionRenderer } from './IShipOptionRender';

export interface ISelectOptionScroller {
  options: React.ReactNode[];
  // TODO:
  // renderer: React.ForwardRefExoticComponent<IShipOptionRenderer & React.RefAttributes<HTMLDivElement>>;
  renderer: any;
}
