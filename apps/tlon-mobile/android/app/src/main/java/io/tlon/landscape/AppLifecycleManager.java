package io.tlon.landscape;

import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import io.tlon.landscape.images.GlideMemoryTrimmer;

public class AppLifecycleManager implements DefaultLifecycleObserver {
    private final MainApplication application;

    public AppLifecycleManager(MainApplication application) {
        this.application = application;
    }

    @Override
    public void onStart(@NonNull LifecycleOwner owner) {
        ReactHealthMonitor.start(application);
    }

    @Override
    public void onStop(@NonNull LifecycleOwner owner) {
        ReactHealthMonitor.stop();
        GlideMemoryTrimmer.onBackground(application);
    }
}
