package io.tlon.landscape;

import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import com.facebook.react.ReactApplication;

public class AppLifecycleManager implements DefaultLifecycleObserver {
    private final ReactApplication reactApplication;

    public AppLifecycleManager(ReactApplication reactApplication) {
        this.reactApplication = reactApplication;
    }

    @Override
    public void onStart(@NonNull LifecycleOwner owner) {
        ReactHealthMonitor.start(reactApplication);
    }

    @Override
    public void onStop(@NonNull LifecycleOwner owner) {
        ReactHealthMonitor.stop();
    }
}
