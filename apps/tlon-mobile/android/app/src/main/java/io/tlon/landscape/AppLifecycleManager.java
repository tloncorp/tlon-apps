package io.tlon.landscape;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import com.facebook.react.ReactApplication;

/**
 * Manages app lifecycle events and coordinates with JSThreadMonitor and JSHeartbeatMonitor.
 * Registered with ProcessLifecycleOwner in MainApplication to receive foreground/background events.
 */
public class AppLifecycleManager implements DefaultLifecycleObserver {

    private static final String TAG = "AppLifecycleManager";
    public static boolean isInForeground = false;

    private final ReactApplication reactApplication;
    private boolean isFirstStart = true;

    public AppLifecycleManager(ReactApplication reactApplication) {
        this.reactApplication = reactApplication;
    }

    @Override
    public void onStart(@NonNull LifecycleOwner owner) {
        isInForeground = true;

        try {
            JSThreadMonitor.startMonitoring(reactApplication);
        } catch (Exception e) {
            Log.w(TAG, "Could not start JSThreadMonitor: " + e.getMessage());
        }

        String eventType = isFirstStart ? "launch" : "resume";
        try {
            JSHeartbeatMonitor.expectHeartbeat(eventType);
        } catch (Exception e) {
            Log.w(TAG, "Could not start JSHeartbeatMonitor: " + e.getMessage());
        }

        isFirstStart = false;
    }

    @Override
    public void onStop(@NonNull LifecycleOwner owner) {
        isInForeground = false;
        JSThreadMonitor.stopMonitoring();
        JSHeartbeatMonitor.cancelExpectation();
    }
}
