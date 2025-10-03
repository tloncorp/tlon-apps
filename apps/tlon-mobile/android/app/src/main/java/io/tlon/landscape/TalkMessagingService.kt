package io.tlon.landscape

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import org.json.JSONObject
import expo.modules.constants.ConstantsService
import io.tlon.landscape.notifications.NotificationException
import io.tlon.landscape.notifications.NotificationLogger
import io.tlon.landscape.notifications.TalkNotificationManager
import io.tlon.landscape.notifications.buildMessagingTappable
import io.tlon.landscape.notifications.processNotificationBlocking
import io.tlon.landscape.notifications.toBasicBundle
import android.service.notification.StatusBarNotification
import io.tlon.landscape.utils.UvParser

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
                    try {
                        data["uid"]?.let { uid ->
                            processNotificationBlocking(this, uid)
                        }
                    } catch (e: NotificationException) {
                        NotificationLogger.logError(e)
                        showFallbackNotification(this, e, remoteMessage)
                    }
                }

                if (data["action"] == "dismiss") {
                    try {
                        data["dismissSource"]?.let { source ->
                            dismissNotifications(this, source)
                        }
                    } catch (e: Error) {
                        data["uid"]?.let { uid ->
                            NotificationLogger.logError(NotificationException("Dismiss source missing", uid, null, e))
                        }
                    }
                }
            }
    }

    private fun dismissNotifications(context: Context, dismissSource: String) {
        val notificationManager = NotificationManagerCompat.from(context)
        val activeNotifications: List<StatusBarNotification> =
            notificationManager.activeNotifications

        for (notification in activeNotifications) {
            if (notification.notification.group == dismissSource) {
                notificationManager.cancel(notification.id)
            }
        }
    }

    private fun showFallbackNotification(
        context: Context,
        exception: NotificationException,
        originalPayload: RemoteMessage
    ) {
        val uid = exception.uid
        val id = UvParser.getIntCompatibleFromUv(uid)
        // Check permissions
        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            NotificationLogger.logError(
                NotificationException(uid, "Lacking notification permissions")
            )
            Log.w(TALK_MESSAGING_SERVICE, "Cannot show notification - no permission")
            return
        }

        val bundle = originalPayload.toBasicBundle()

        // Extract basic info from original payload or use defaults
        val title = bundle.getString("title") ?: "New message"
        val body = bundle.getString("body") ?: "You have a new message"

        val extras = Bundle()
        if (exception.activityEvent != null) {
            extras.putString("activityEventJsonString", exception.activityEvent)
        }
        extras.putString("fallbackReason", exception.message)

        val builder = NotificationCompat.Builder(context, TalkNotificationManager.CHANNEL_ID)
            .buildMessagingTappable(context, id, extras)
            .setContentTitle(title)
            .setContentText(body)

        try {
            NotificationManagerCompat.from(context).notify(id, builder.build())
            NotificationLogger.logDelivery(mapOf(
                "uid" to uid,
                "message" to "Fallback notification delivered successfully"
            ))
            Log.i(TALK_MESSAGING_SERVICE, "Showed fallback notification for uid: $uid, reason: ${exception.message}")
        } catch (e: Exception) {
            val message = "Failed to display fallback notification"
            NotificationLogger.logError(NotificationException(uid, message, null, e))
            Log.e(TALK_MESSAGING_SERVICE, message, e)
        }
    }
}