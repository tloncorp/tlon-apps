import { TailwindProvider } from 'tailwind-rn';
import { registerRootComponent } from 'expo';
import utilities from './tailwind.json';
import App from './src/App';

function Main() {
  return (
    <TailwindProvider utilities={utilities}>
      <App />
    </TailwindProvider>
  );
}

registerRootComponent(Main);
