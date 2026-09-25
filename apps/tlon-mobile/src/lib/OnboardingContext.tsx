import {
  RecaptchaAction,
  execute,
  initClient,
} from '@google-cloud/recaptcha-enterprise-react-native';
import {
  getHostingAvailability,
  getLandscapeAuthCookie,
  requestLoginOtp,
  requestSignupOtp,
} from '@tloncorp/api';
import * as store from '@tloncorp/shared/store';
import { createContext, useContext } from 'react';

// The hosting calls the onboarding screens make, injectable for fixtures.
const hostingApi = {
  getHostingAvailability,
  requestLoginOtp,
  requestSignupOtp,
};

interface OnboardingContextValue {
  hostingApi: typeof hostingApi;
  initRecaptcha: typeof initClient;
  execRecaptchaLogin: () => Promise<string>;
  execRecaptchaRequestOtp: () => Promise<string>;
  getLandscapeAuthCookie: typeof getLandscapeAuthCookie;
  checkPhoneVerify: typeof store.checkPhoneVerify;
  requestPhoneVerify: typeof store.requestPhoneVerify;
  signUpHostedUser: typeof store.signUpHostedUser;
  logInHostedUser: typeof store.logInHostedUser;
}

export const OnboardingContext = createContext<OnboardingContextValue>({
  initRecaptcha: initClient,
  execRecaptchaLogin: () => execute(RecaptchaAction.LOGIN(), 10_000),
  execRecaptchaRequestOtp: () =>
    execute(RecaptchaAction.custom('request_otp'), 10_000),
  getLandscapeAuthCookie,
  hostingApi,
  checkPhoneVerify: store.checkPhoneVerify,
  requestPhoneVerify: store.requestPhoneVerify,
  signUpHostedUser: store.signUpHostedUser,
  logInHostedUser: store.logInHostedUser,
});

export const OnboardingProvider = OnboardingContext.Provider;

export const useOnboardingContext = () => useContext(OnboardingContext);
