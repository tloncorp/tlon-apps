# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# realm
-keep class io.realm.react.**

# Expo loads these reflectively for headless JS (background tasks, notifications,
# share-intent); R8 strips them without an explicit keep, so the class lookup
# (e.g. RNHeadlessAppLoader) fails at runtime. Fixed upstream in expo/expo#46920
# (class-level @DoNotStrip), which lands in SDK 57 / expo-modules-core from main —
# remove this keep once on a release that includes it.
-keep class expo.modules.adapters.react.** { *; }

# Notification telemetry reports exception class names; keep Volley's readable
# for any error NotificationLogger does not name by hand.
-keepnames class com.android.volley.*Error

# R8's strict full mode (the AGP 9 default) no longer keeps the default
# constructor of a class kept by a bare `-keep class` rule. Room 2.5 and
# WorkManager 2.9 ship such rules but create these classes by reflection
# through that constructor; without it WorkManager crashes at startup creating
# WorkDatabase_Impl.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class * extends androidx.work.InputMerger { public <init>(); }

# Native code constructs these exceptions through JNI by signature
# (expo-modules-core's cpp/Exceptions.cpp; React Native's JMessageQueueThread
# via ThrowNew). Class-level @DoNotStrip keeps only the class, so R8 inlines a
# constructor into its Kotlin callers or drops it when nothing in Java calls
# it, and the native throw then fails with NoSuchMethodError.
-keepclassmembers class expo.modules.kotlin.exception.JavaScriptEvaluateException {
    <init>(java.lang.String, java.lang.String);
}
-keepclassmembers class expo.modules.kotlin.exception.UnexpectedException {
    <init>(java.lang.String);
}
-keepclassmembers class expo.modules.kotlin.exception.InvalidArgsNumberException {
    <init>(int, int, int);
}
-keepclassmembers class com.facebook.react.common.JavascriptException {
    <init>(java.lang.String);
}

# Add any project specific keep options here:
