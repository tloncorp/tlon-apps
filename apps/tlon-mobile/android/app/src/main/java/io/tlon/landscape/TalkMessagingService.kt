package io.tlon.landscape

import android.annotation.SuppressLint
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import org.json.JSONObject
import expo.modules.constants.ConstantsService
import io.tlon.landscape.notifications.processNotificationBlocking

private const val TALK_MESSAGING_SERVICE = "talk-messaging-service"

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
                    val cs = ConstantsService(this)
                    val constants = JSONObject(cs.constants["manifest"] as String);
                    Log.d(TALK_MESSAGING_SERVICE, constants.toString())
                    val key = constants.getJSONObject("extra").getString("postHogApiKey");
                    Log.d(TALK_MESSAGING_SERVICE, key)
                    if (key.isNullOrEmpty()) {
                        Log.w(TALK_MESSAGING_SERVICE, "PostHog API key is empty, skipping initialization")
                        return
                    }
                    val config = PostHogAndroidConfig(
                        apiKey = key,
                        host = "https://eu.i.posthog.com"
                    )
                    PostHogAndroid.setup(applicationContext, config)
                    isPostHogInitialized = true
                    Log.d(TALK_MESSAGING_SERVICE, "PostHog initialized in service")
                } catch (e: Exception) {
                    Log.e(TALK_MESSAGING_SERVICE, "Failed to initialize PostHog in service", e)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TALK_MESSAGING_SERVICE, "service initialized!")
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