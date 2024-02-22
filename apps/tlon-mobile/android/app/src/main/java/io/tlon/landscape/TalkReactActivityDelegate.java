package io.tlon.landscape;

import android.os.Bundle;

import androidx.annotation.NonNull;

import com.facebook.react.ReactActivity;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

public class TalkReactActivityDelegate extends DefaultReactActivityDelegate {

    public TalkReactActivityDelegate(@NonNull ReactActivity activity, @NonNull String mainComponentName, boolean fabricEnabled, boolean concurrentRootEnabled) {
        super(activity, mainComponentName, fabricEnabled, concurrentRootEnabled);
    }

    @Override
    protected Bundle getLaunchOptions() {
        Bundle params = getPlainActivity().getIntent().getExtras();
        getPlainActivity().getIntent().replaceExtras(new Bundle());
        return params;
    }

}
