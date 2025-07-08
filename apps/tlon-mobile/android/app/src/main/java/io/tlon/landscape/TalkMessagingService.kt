package io.tlon.landscape

import android.annotation.SuppressLint
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import com.posthog.PostHog
import io.tlon.landscape.BuildConfig
import io.tlon.landscape.notifications.processNotificationBlocking

@SuppressLint("MissingFirebaseInstanceTokenRefresh")
class TalkMessagingService : FirebaseMessagingService() {

    companion object {
        private var isPostHogInitialized = false
        private val initLock = Any()
    }

    /**
     * Initialize PostHog if not already initialized
     * This handles the case where the service starts without the main app running
     */
    private fun ensurePostHogInitialized() {
        synchronized(initLock) {
            if (!isPostHogInitialized) {
                try {
                    if (BuildConfig.POSTHOG_API_KEY.isBlank()) {
                        Log.w("FirebaseService", "PostHog API key is empty, skipping initialization")
                        return
                    }
                    val config = PostHogAndroidConfig(
                        apiKey = BuildConfig.POSTHOG_API_KEY,
                        host = BuildConfig.POSTHOG_HOST
                    )
                    PostHogAndroid.setup(applicationContext, config)
                    isPostHogInitialized = true
                    Log.d("FirebaseService", "PostHog initialized in service")
                } catch (e: Exception) {
                    Log.e("FirebaseService", "Failed to initialize PostHog in service", e)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        ensurePostHogInitialized()
    }

    /**
     * Called when message is received.
     *
     * @param remoteMessage Object representing the message received from Firebase Cloud Messaging.
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Check if message contains a data payload.
        if (remoteMessage.data.isNotEmpty()) {
            val data = remoteMessage.data
            if (data["action"] == "notify") {
                data["uid"]?.let { uid ->
                    processNotificationBlocking(this, uid, remoteMessage)
                }
            }
        }
    }
}