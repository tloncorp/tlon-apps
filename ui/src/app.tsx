import React, { useEffect, useState } from 'react';
import Urbit from '@urbit/http-api';
import { Charges, ChargeUpdateInitial, scryCharges } from '@urbit/api';
import AppTile from './components/app-tile/AppTile';

const api = new Urbit('', '', window.desk);
api.ship = window.ship;

export default function App() {
    const [apps, setApps] = useState<Charges>();

    useEffect(() => {
        async function init() {
            const charges =
                import.meta.env.MODE === 'mock'
                    ? (await import('./mocks/charges.json')).default
                    : await api.scry<ChargeUpdateInitial>(scryCharges);
            setApps(charges.initial);
        }

        init();
    }, []);

    return (
        <main className="flex justify-center items-center min-h-screen">
            <div className="py-20 space-y-6 max-w-md">
                <h1 className="text-3xl font-bold text-blue">
                    Welcome to homestead
                </h1>
                <p className="font-mono">
                    Here&apos;s your urbit&apos;s installed apps:
                </p>
                {apps && (
                    <ul className="space-y-4">
                        {Object.entries(apps).map(([desk, app]) => (
                            <li
                                key={desk}
                                className="flex items-center space-x-3 text-sm leading-tight"
                            >
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
