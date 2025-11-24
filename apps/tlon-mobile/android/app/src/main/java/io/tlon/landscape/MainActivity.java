package io.tlon.landscape;

import android.os.Build;
import android.os.Bundle;
import android.content.Intent;
import android.view.View;
import android.util.Log;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;

import com.facebook.react.ReactActivity;
import com.posthog.PostHog;
import com.posthog.android.PostHogAndroid;
import com.posthog.android.PostHogAndroidConfig;

import java.util.HashMap;
import java.util.Map;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

import expo.modules.ReactActivityDelegateWrapper;
import expo.modules.constants.ConstantsService;

import io.branch.rnbranch.*;

import org.json.JSONObject;

public class MainActivity extends ReactActivity {

  private static boolean isPostHogInitialized = false;
  private static final Object initLock = new Object();

  /**
   * Captures a lifecycle event via PostHog native SDK.
   * This ensures events are captured even if the JS thread is locked.
   */
  private void captureLifecycleEvent(String eventName) {
    try {
      Map<String, Object> properties = new HashMap<>();
      properties.put("source", "native_android");
      properties.put("$lib", "android-native");
      PostHog.Companion.capture(eventName, null, properties, null, null, null, null);
      Log.i("PostHog", "Native " + eventName + " event captured");
    } catch (Exception e) {
      Log.e("PostHog", "Failed to capture " + eventName + " event: " + e.getMessage());
    }
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null);
    ensurePostHogInitialized();
    captureLifecycleEvent("App Created");

    // Handle window insets for Android API 35+
    // ref: https://github.com/facebook/react-native/issues/49759#issuecomment-3048056660
    if (Build.VERSION.SDK_INT >= 35) {
        View rootView = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, insets) -> {
            Insets innerPadding = insets.getInsets(WindowInsetsCompat.Type.ime());
            rootView.setPadding(
                innerPadding.left,
                innerPadding.top,
                innerPadding.right,
                innerPadding.bottom
            );
            return insets;
        });
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript.
   * This is used to schedule rendering of the component.
   */
  @Override
  protected String getMainComponentName() {
    return "main";
  }

  @Override
  protected void onStart() {
    super.onStart();
    captureLifecycleEvent("App Started");
    RNBranchModule.initSession(getIntent().getData(), this);
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    captureLifecycleEvent("App New Intent");
    RNBranchModule.onNewIntent(intent);
  }

  @Override
  protected void onResume() {
    super.onResume();
    captureLifecycleEvent("App Resumed");
  }

  @Override
  protected void onPause() {
    captureLifecycleEvent("App Paused");
    super.onPause();
  }

  @Override
  protected void onStop() {
    captureLifecycleEvent("App Stopped");
    super.onStop();
  }

  @Override
  protected void onDestroy() {
    captureLifecycleEvent("App Destroyed");
    super.onDestroy();
  }

  /**
   * Returns the instance of the {@link ReactActivityDelegate}. Here we use a util class {@link
   * DefaultReactActivityDelegate} which allows you to easily enable Fabric and Concurrent React
   * (aka React 18) with two boolean flags.
   */
  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, new DefaultReactActivityDelegate(
        this,
        getMainComponentName(),
        // If you opted-in for the New Architecture, we enable the Fabric Renderer.
        DefaultNewArchitectureEntryPoint.getFabricEnabled(), // fabricEnabled
        // If you opted-in for the New Architecture, we enable Concurrent React (i.e. React 18).
        DefaultNewArchitectureEntryPoint.getConcurrentReactEnabled() // concurrentRootEnabled
        ));
  }

  /**
   * Align the back button behavior with Android S
   * where moving root activities to background instead of finishing activities.
   * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
   */
  @Override
  public void invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        // For non-root activities, use the default implementation to finish them.
        super.invokeDefaultOnBackPressed();
      }
      return;
    }

    // Use the default back button implementation on Android S
    // because it's doing more than {@link Activity#moveTaskToBack} in fact.
    super.invokeDefaultOnBackPressed();
  }

    /**
   * Initialize PostHog if not already initialized
   */
  private void ensurePostHogInitialized() {
    synchronized(initLock) {
      if (!isPostHogInitialized) {
        try {
          ConstantsService cs = new ConstantsService(this);
          JSONObject constants = new JSONObject((String) cs.getConstants().get("manifest"));
          String key = constants.getJSONObject("extra").getString("postHogApiKey");
          if (key == null || key.isEmpty()) {
            Log.w("MainActivity", "PostHog API key is empty, skipping initialization");
            return;
          }
          PostHogAndroidConfig config = new PostHogAndroidConfig(key, "https://eu.i.posthog.com");
          PostHogAndroid.Companion.setup(getApplicationContext(), config);
          isPostHogInitialized = true;
          Log.d("MainActivity", "PostHog initialized in MainActivity");
        } catch (Exception e) {
          Log.e("MainActivity", "Failed to initialize PostHog in MainActivity", e);
        }
      }
    }
  }

}

