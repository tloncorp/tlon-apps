import {
  TamaguiProvider as BaseTamaguiProvider,
  TamaguiProviderProps,
} from "tamagui";
import { config } from "../tamagui.config";

export function TamaguiProvider(props: TamaguiProviderProps) {
  return <BaseTamaguiProvider config={config} {...props} />;
}
