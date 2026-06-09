package io.tlon.landscape;

import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.util.Random;
import io.tlon.landscape.storage.SecureStorage;

public class UrbitModule extends ReactContextBaseJavaModule {

    UrbitModule(ReactApplicationContext context) {
        super(context);
        ReactHealthMonitor.setReactContext(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "UrbitModule";
    }

    @ReactMethod
    public void setUrbit(String shipName, String shipUrl, String authCookie) {
        SharedPreferences.Editor editor = SecureStorage.sharedPreferences.edit();
        editor.putString(SecureStorage.SHIP_NAME_KEY, shipName);
        editor.putString(SecureStorage.SHIP_URL_KEY, shipUrl);
        editor.putString(SecureStorage.AUTH_COOKIE_KEY, authCookie.split(";")[0]);
        String uid = Long.toString(System.currentTimeMillis() / 1000L) + "-" + String.format("%06x", new Random().nextInt(0x1000000));
        editor.putString(SecureStorage.CHANNEL_URL, shipUrl + "/~/channel/" + uid);
        editor.apply();
    }

    @ReactMethod
    public void clearUrbit() {
        SecureStorage.clear();
    }

    // Caches whether the connected backend's %activity supports reactions, so
    // the notification service can choose the v9 (activity-event-1) vs v8
    // (activity-event) fetch without scrying for a version itself.
    @ReactMethod
    public void setActivitySupportsReactions(boolean supported) {
        SharedPreferences.Editor editor = SecureStorage.sharedPreferences.edit();
        editor.putBoolean(SecureStorage.ACTIVITY_SUPPORTS_REACTIONS_KEY, supported);
        editor.apply();
    }

    @ReactMethod
    public void updateBadgeCount(int count, String uid) {}

    @ReactMethod
    public void signalJsReady() {
        ReactHealthMonitor.signalJsReady();
    }
}
