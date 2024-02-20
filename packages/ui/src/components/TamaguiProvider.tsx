import { TamaguiProvider as BaseTamaguiProvider } from "tamagui";
import { config } from "../tamagui.config";

export function TamaguiProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseTamaguiProvider config={config} defaultTheme="light">
      {children}
    </BaseTamaguiProvider>
  );
}
