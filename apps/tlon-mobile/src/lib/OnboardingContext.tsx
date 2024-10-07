import {
  RecaptchaAction,
  execute,
  initClient,
} from '@google-cloud/recaptcha-enterprise-react-native';
import * as hostingApi from '@tloncorp/app/lib/hostingApi';
import { getLandscapeAuthCookie } from '@tloncorp/shared/dist/api';
import { createContext, useContext } from 'react';

interface OnboardingContextValue {
  hostingApi: typeof hostingApi;
  initRecaptcha: typeof initClient;
  execRecaptchaLogin: () => Promise<string>;
  getLandscapeAuthCookie: typeof getLandscapeAuthCookie;
}

export const OnboardingContext = createContext<OnboardingContextValue>({
  initRecaptcha: initClient,
  execRecaptchaLogin: () => execute(RecaptchaAction.LOGIN(), 10_000),
  getLandscapeAuthCookie,
  hostingApi,
});

export const OnboardingProvider = OnboardingContext.Provider;

export const useOnboardingContext = () => useContext(OnboardingContext);
