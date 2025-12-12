package io.tlon.landscape;

import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.Random;

import io.tlon.landscape.storage.SecureStorage;

public class UrbitModule extends ReactContextBaseJavaModule {

    private static final String TAG = "UrbitModule";

    UrbitModule(ReactApplicationContext context) {
        super(context);
        try {
            JSThreadMonitor.setReactContext(context);
        } catch (Exception e) {
            Log.w(TAG, "Could not set ReactContext: " + e.getMessage());
        }
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

    @ReactMethod
    public void updateBadgeCount(int count, String uid) {
       // For now, no-op on Android
    }

    @ReactMethod
    public void signalJsReady() {
        JSHeartbeatMonitor.signalReady();
    }

}
