import {
  RecaptchaAction,
  execute,
  initClient,
} from '@google-cloud/recaptcha-enterprise-react-native';
import * as hostingApi from '@tloncorp/api';
import { getLandscapeAuthCookie } from '@tloncorp/api';
import * as store from '@tloncorp/shared/store';
import { createContext, useContext } from 'react';

interface OnboardingContextValue {
  hostingApi: typeof hostingApi;
  initRecaptcha: typeof initClient;
  execRecaptchaLogin: () => Promise<string>;
  getLandscapeAuthCookie: typeof getLandscapeAuthCookie;
  checkPhoneVerify: typeof store.checkPhoneVerify;
  requestPhoneVerify: typeof store.requestPhoneVerify;
  signUpHostedUser: typeof store.signUpHostedUser;
  logInHostedUser: typeof store.logInHostedUser;
}

export const OnboardingContext = createContext<OnboardingContextValue>({
  initRecaptcha: initClient,
  execRecaptchaLogin: () => execute(RecaptchaAction.LOGIN(), 10_000),
  getLandscapeAuthCookie,
  hostingApi,
  checkPhoneVerify: store.checkPhoneVerify,
  requestPhoneVerify: store.requestPhoneVerify,
  signUpHostedUser: store.signUpHostedUser,
  logInHostedUser: store.logInHostedUser,
});

export const OnboardingProvider = OnboardingContext.Provider;

export const useOnboardingContext = () => useContext(OnboardingContext);
