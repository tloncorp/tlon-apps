package io.tlon.landscape

import android.app.Application
import android.content.res.Configuration
import androidx.annotation.NonNull
import androidx.lifecycle.ProcessLifecycleOwner
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory
import io.tlon.landscape.notifications.TalkNotificationManager
import io.tlon.landscape.storage.SecureStorage
import io.branch.rnbranch.RNBranchModule
import java.io.IOException
import java.security.GeneralSecurityException

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages.apply {
        add(TalkPackage())
      },
      jsMainModulePath = "index"
    )
  }

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = ReleaseLevel.STABLE
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
