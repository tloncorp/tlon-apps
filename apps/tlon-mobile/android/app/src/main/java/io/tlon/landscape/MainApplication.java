package io.tlon.landscape;

import android.app.Application;
import android.content.res.Configuration;

import androidx.annotation.NonNull;
import androidx.lifecycle.ProcessLifecycleOwner;

import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.facebook.soloader.SoLoader;

import expo.modules.ApplicationLifecycleDispatcher;
import expo.modules.ReactNativeHostWrapper;
import io.tlon.landscape.notifications.TalkNotificationManager;
import io.tlon.landscape.storage.SecureStorage;

import io.branch.rnbranch.RNBranchModule;

import com.posthog.android.PostHogAndroid;
import com.posthog.android.PostHogAndroidConfig;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

  public static final String POSTHOG_API_KEY = "phc_GyI5iD7kM6RRbb1hIU0fiGmTCh4ha44hthJYJ7a89td";
  public static final String POSTHOG_HOST = "https://eu.i.posthog.com";

  private final ReactNativeHost mReactNativeHost =
    new ReactNativeHostWrapper(this, new DefaultReactNativeHost(this) {
      @Override
      public boolean getUseDeveloperSupport() {
        return BuildConfig.DEBUG;
      }

      @Override
      protected List<ReactPackage> getPackages() {
        @SuppressWarnings("UnnecessaryLocalVariable")
        List<ReactPackage> packages = new PackageList(this).getPackages();
        packages.add(new TalkPackage());
        return packages;
      }

      @Override
      protected String getJSMainModuleName() {
        return "index";
      }

      @Override
      protected boolean isNewArchEnabled() {
        return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
      }

      @Override
      protected Boolean isHermesEnabled() {
        return BuildConfig.IS_HERMES_ENABLED;
      }
  });

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    SoLoader.init(this, /* native exopackage */ false);
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      DefaultNewArchitectureEntryPoint.load();
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this);
    ProcessLifecycleOwner.get().getLifecycle().addObserver(new AppLifecycleManager());

    try {
      SecureStorage.create(this);
    } catch (GeneralSecurityException | IOException e) {
      throw new RuntimeException(e);
    }

    TalkNotificationManager.createNotificationChannel(this);

    PostHogAndroidConfig config = new PostHogAndroidConfig(
        POSTHOG_API_KEY,
        POSTHOG_HOST
    );
    PostHogAndroid.Companion.setup(this, config);

    // Branch logging for debugging
    if (BuildConfig.DEBUG) {
      RNBranchModule.enableLogging();
    }

    RNBranchModule.getAutoInstance(this);
  }

  @Override
  public void onConfigurationChanged(@NonNull Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig);
  }

}
