package io.tlon.landscape;

import android.app.Activity;
import android.content.res.Configuration;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

/**
 * Native module to query Android's current UI mode directly.
 * This bypasses React Native's Appearance module which can return stale values
 * when the system theme changes while the app is backgrounded.
 */
public class ThemeModule extends ReactContextBaseJavaModule {
    public ThemeModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    @NonNull
    public String getName() {
        return "TlonTheme";
    }

    /**
     * Returns the current system color scheme by querying Android's Configuration directly.
     * Uses the current Activity's configuration which is more up-to-date than the
     * Application context's configuration after returning from background.
     * Returns "dark" or "light".
     */
    @ReactMethod
    public void getColorScheme(Promise promise) {
        try {
            Configuration config;
            Activity activity = getCurrentActivity();
            if (activity != null) {
                // Prefer Activity's configuration - more up-to-date after resume
                config = activity.getResources().getConfiguration();
            } else {
                // Fallback to Application context
                config = getReactApplicationContext().getResources().getConfiguration();
            }
            int nightMode = config.uiMode & Configuration.UI_MODE_NIGHT_MASK;
            String colorScheme = (nightMode == Configuration.UI_MODE_NIGHT_YES) ? "dark" : "light";
            promise.resolve(colorScheme);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to get color scheme", e);
        }
    }
}
