import React, { useEffect, useState } from 'react';
import Urbit from '@urbit/http-api';
import { Charges, ChargeUpdateInitial, scryCharges } from '@urbit/api';
import { AppTile } from './components/AppTile';

const api = new Urbit('', '', window.desk);
api.ship = window.ship;

export function App() {
  const [apps, setApps] = useState<Charges>();

  useEffect(() => {
    async function init() {
      const charges = (await api.scry<ChargeUpdateInitial>(scryCharges)).initial;
      setApps(charges);
    }

    init();
  }, []);

  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="max-w-md space-y-6 py-20">
        <h1 className="text-3xl font-bold">Welcome to homestead</h1>
        <p>Here&apos;s your urbit&apos;s installed apps:</p>
        {apps && (
          <ul className="space-y-4">
            {Object.entries(apps).map(([desk, app]) => (
              <li key={desk} className="flex items-center space-x-3 text-sm leading-tight">
                <AppTile {...app} />
                <div className="flex-1 text-black">
                  <p>
                    <strong>{app.title || desk}</strong>
                  </p>
                  {app.info && <p>{app.info}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
