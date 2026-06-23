package io.tlon.landscape

import android.app.Application
import android.content.res.Configuration
import androidx.annotation.NonNull
import androidx.lifecycle.ProcessLifecycleOwner
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper
import io.tlon.landscape.notifications.TalkNotificationManager
import io.tlon.landscape.storage.SecureStorage
import io.branch.rnbranch.RNBranchModule
import java.io.IOException
import java.security.GeneralSecurityException

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
    ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
          PackageList(this).packages.apply {
            // Add custom packages here
            add(TalkPackage())
          }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }
    )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)

    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    ProcessLifecycleOwner.get().lifecycle.addObserver(AppLifecycleManager(this))

    try {
      SecureStorage.create(this)
    } catch (e: GeneralSecurityException) {
      throw RuntimeException(e)
    } catch (e: IOException) {
      throw RuntimeException(e)
    }

    TalkNotificationManager.createNotificationChannel(this)

    // Branch logging for debugging
    if (BuildConfig.DEBUG) {
      RNBranchModule.enableLogging()
    }

    RNBranchModule.getAutoInstance(this)
  }

  override fun onConfigurationChanged(@NonNull newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
