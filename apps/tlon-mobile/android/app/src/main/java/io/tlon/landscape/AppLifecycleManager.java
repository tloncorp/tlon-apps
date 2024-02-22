package io.tlon.landscape;

import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

public class AppLifecycleManager implements DefaultLifecycleObserver {

    public static boolean isInForeground = true;

    @Override
    public void onStart(@NonNull LifecycleOwner owner) {
        isInForeground = true;
    }

    @Override
    public void onStop(@NonNull LifecycleOwner owner) {
        isInForeground = false;
    }
}
