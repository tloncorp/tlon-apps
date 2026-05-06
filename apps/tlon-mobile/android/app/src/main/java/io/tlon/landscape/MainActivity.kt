package io.tlon.landscape

import android.os.Build
import android.os.Bundle
import android.content.Intent
import android.util.Log
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.graphics.Insets
import com.facebook.react.ReactActivity
import com.posthog.PostHog
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper
import expo.modules.constants.ConstantsService
import io.branch.rnbranch.RNBranchModule
import org.json.JSONObject

class MainActivity : ReactActivity() {

  companion object {
    private var isPostHogInitialized = false
    private val initLock = Any()
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme)
    super.onCreate(null)
    ensurePostHogInitialized()
    captureLifecycleEvent("App Created")

    // Handle window insets for Android API 35+
    // ref: https://github.com/facebook/react-native/issues/49759#issuecomment-3048056660
    if (Build.VERSION.SDK_INT >= 35) {
      val rootView = findViewById<View>(android.R.id.content)
      ViewCompat.setOnApplyWindowInsetsListener(rootView) { v, insets ->
        val innerPadding = insets.getInsets(WindowInsetsCompat.Type.ime())
        rootView.setPadding(
          innerPadding.left,
          innerPadding.top,
          innerPadding.right,
          innerPadding.bottom
        )
        insets
      }
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript.
   * This is used to schedule rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  override fun onStart() {
    super.onStart()
    captureLifecycleEvent("App Started")
    RNBranchModule.initSession(intent.data, this)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    captureLifecycleEvent("App New Intent")
    RNBranchModule.onNewIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    captureLifecycleEvent("App Resumed")
  }

  override fun onPause() {
    captureLifecycleEvent("App Paused")
    super.onPause()
  }

  override fun onStop() {
    captureLifecycleEvent("App Stopped")
    super.onStop()
  }

  override fun onDestroy() {
    captureLifecycleEvent("App Destroyed")
    super.onDestroy()
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flag [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
    ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
    )

  /**
   * Align the back button behavior with Android S
   * where moving root activities to background instead of finishing activities.
   * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
   */
  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        // For non-root activities, use the default implementation to finish them.
        super.invokeDefaultOnBackPressed()
      }
      return
    }

    // Use the default back button implementation on Android S
    // because it's doing more than Activity.moveTaskToBack in fact.
    super.invokeDefaultOnBackPressed()
  }

  /**
   * Captures a lifecycle event via PostHog native SDK.
   * This ensures events are captured even if the JS thread is locked.
   */
  private fun captureLifecycleEvent(eventName: String) {
    try {
      val properties = mapOf(
        "source" to "native_android",
        "\$lib" to "android-native"
      )
      PostHog.capture(eventName, null, properties, null, null, null)
      Log.i("PostHog", "Native $eventName event captured")
    } catch (e: Exception) {
      Log.e("PostHog", "Failed to capture $eventName event: ${e.message}")
    }
  }

  /**
   * Initialize PostHog if not already initialized
   */
  private fun ensurePostHogInitialized() {
    synchronized(initLock) {
      if (!isPostHogInitialized) {
        try {
          val cs = ConstantsService(this)
          val constants = JSONObject(cs.constants["manifest"] as String)
          val key = constants.getJSONObject("extra").getString("postHogApiKey")
          if (key.isNullOrEmpty()) {
            Log.w("MainActivity", "PostHog API key is empty, skipping initialization")
            return
          }
          val config = PostHogAndroidConfig(key, "https://eu.i.posthog.com")
          PostHogAndroid.setup(applicationContext, config)
          isPostHogInitialized = true
          Log.d("MainActivity", "PostHog initialized in MainActivity")
        } catch (e: Exception) {
          Log.e("MainActivity", "Failed to initialize PostHog in MainActivity", e)
        }
      }
    }
  }
}
