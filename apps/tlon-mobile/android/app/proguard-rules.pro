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

# Add any project specific keep options here:
