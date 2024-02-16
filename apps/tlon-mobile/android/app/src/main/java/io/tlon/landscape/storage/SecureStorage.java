package io.tlon.landscape.storage;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import java.io.IOException;
import java.security.GeneralSecurityException;

public class SecureStorage {

    public static String SHIP_NAME_KEY = "shipName";
    public static String SHIP_URL_KEY = "shipUrl";
    public static String AUTH_COOKIE_KEY = "authCookie";
    public static String CHANNEL_URL = "channelUrl";

    public static SharedPreferences sharedPreferences;

    public static void create(Context context) throws GeneralSecurityException, IOException {
        MasterKey masterKey = new MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();

        sharedPreferences = EncryptedSharedPreferences.create(
                context,
                "talkSecrets",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
    }

    public static String getString(String key) {
        return sharedPreferences.getString(key, null);
    }

    public static boolean getBoolean(String key) {
        return sharedPreferences.getBoolean(key, false);
    }

    public static void clear() {
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.remove(SHIP_NAME_KEY);
        editor.remove(SHIP_URL_KEY);
        editor.remove(AUTH_COOKIE_KEY);
        editor.remove(CHANNEL_URL);
        editor.apply();
    }

}
