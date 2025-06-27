package io.tlon.landscape.notifications

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationCompat.MessagingStyle
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import com.android.volley.VolleyError
import com.google.firebase.messaging.RemoteMessage
import io.tlon.landscape.MainActivity
import io.tlon.landscape.api.TalkApi
import io.tlon.landscape.api.TalkObjectCallback
import io.tlon.landscape.R
import io.tlon.landscape.storage.SecureStorage
import io.tlon.landscape.utils.UvParser
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import java.util.Date
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine
import com.posthog.PostHog

const val MAX_CACHED_CONVERSATION_LENGTH = 15
val notificationMessagesCache = HashMap<String, Array<NotificationCompat.MessagingStyle.Message>>();

// PostHog logging helper
private fun logNotificationEvent(eventName: String, properties: Map<String, Any>? = emptyMap()) {
    try {
        // Replace with your actual PostHog client initialization
        PostHog.capture(event = eventName, properties = properties)
    } catch (e: Exception) {
        Log.e("NotificationManager", "Failed to log to PostHog", e)
    }
}

suspend fun processNotification(context: Context, uid: String, originalPayload: RemoteMessage? = null) {
    val api = TalkApi(context)
    var activityEvent: JSONObject? = null

    try {
        activityEvent = suspendCoroutine { cnt ->
            api.fetchActivityEvent(uid, object: TalkObjectCallback {
                override fun onComplete(response: JSONObject?) = cnt.resume(response)
                override fun onError(error: VolleyError?) = cnt.resumeWithException(error ?: Error("Unknown error"))
            })
        }
    } catch (e: Exception) {
        logNotificationEvent("notification_api_fetch_failed", mapOf(
            "uid" to uid,
            "error" to e.message.orEmpty()
        ))
        // Fall back to basic notification with original payload
        showFallbackNotification(context, uid, originalPayload, "API fetch failed")
        return
    }

    if (activityEvent == null) {
        logNotificationEvent("notification_activity_event_null", mapOf(
            "uid" to uid
        ))
        showFallbackNotification(context, uid, originalPayload, "No activity event")
        return
    }

    val preview = try {
        renderPreview(context, activityEvent.toString())
    } catch (e: Exception) {
        logNotificationEvent("notification_preview_render_failed", mapOf(
            "uid" to uid,
            "error" to e.message.orEmpty()
        ))
        showFallbackNotification(context, uid, originalPayload, "Preview render failed", activityEvent)
        return
    }

    if (preview == null) {
        logNotificationEvent(
            "notification_preview_null", mapOf(
                "uid" to uid
            )
        )
        showFallbackNotification(context, uid, originalPayload, "Preview is null", activityEvent)
        return
    }

    try {
        // Proceed with rich notification
        showRichNotification(context, uid, preview, activityEvent)
        logNotificationEvent("notification_delivered_rich", mapOf(
            "uid" to uid,
            "title" to (preview.title ?: ""),
            "isGroup" to (preview.messagingMetadata?.isGroupConversation?.toString() ?: "false")
        ))
    } catch (e: Exception) {
        logNotificationEvent("notification_rich_display_failed", mapOf(
            "uid" to uid,
            "error" to e.message.orEmpty()
        ))
        showFallbackNotification(context, uid, originalPayload, "Rich notification failed", activityEvent)
    }
}

private fun showRichNotification(context: Context, uid: String, preview: ActivityEventPreview, activityEvent: JSONObject) {
    val extras = Bundle()
    extras.putString("activityEventJsonString", activityEvent.toString())

    val id = UvParser.getIntCompatibleFromUv(uid)
    val person = preview.messagingMetadata?.sender?.person
    val title = preview.title
    val text = preview.body
    val isGroupConversation = preview.messagingMetadata?.isGroupConversation ?: false

    Log.d("NotificationManager", "sendNotification: $id $title $text $isGroupConversation")

    val tapIntent = Intent(context, MainActivity::class.java)
    tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    tapIntent.replaceExtras(extras)
    val tapPendingIntent = PendingIntent.getActivity(
        context,
        id,
        tapIntent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val markAsReadIntent = Intent(context, TalkBroadcastReceiver::class.java)
    markAsReadIntent.setAction(TalkBroadcastReceiver.MARK_AS_READ_ACTION)
    markAsReadIntent.replaceExtras(extras)
    val markAsReadPendingIntent = PendingIntent.getBroadcast(
        context,
        id,
        markAsReadIntent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val user = Person.Builder().setName(SecureStorage.getString(SecureStorage.SHIP_NAME_KEY)).build()
    val builder: NotificationCompat.Builder =
        NotificationCompat.Builder(context, TalkNotificationManager.CHANNEL_ID)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(title)
            .setContentText(text)
            .addExtras(extras)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(tapPendingIntent)
            .addAction(
                R.drawable.ic_mark_as_read,
                context.getString(R.string.landscape_notification_mark_as_read),
                markAsReadPendingIntent
            )
            .setAutoCancel(true)
            .setGroup(preview.groupingKey)

    if (person != null) {
        val notifStyle = NotificationCompat.MessagingStyle(user)
            .setGroupConversation(isGroupConversation)
            .setConversationTitle(if (isGroupConversation) title else null)

        val incomingMessage = MessagingStyle.Message(text, Date().time, person)
        if (preview.groupingKey != null) {
            val previousMessages = notificationMessagesCache[preview.groupingKey] ?: emptyArray()
            for (message in previousMessages) {
                notifStyle.addMessage(message)
            }

            var nextCachedList = previousMessages.plus(incomingMessage)
            nextCachedList = nextCachedList.takeLast(MAX_CACHED_CONVERSATION_LENGTH - 1).toTypedArray()
            notificationMessagesCache[preview.groupingKey] = nextCachedList
        }
        notifStyle.addMessage(incomingMessage)
        builder.setStyle(notifStyle)
    }

    // Check permissions before proceeding
    if (ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        logNotificationEvent("notification_permission_denied", mapOf(
            "uid" to uid
        ))
        // Could still show fallback, but permissions are required
        Log.w("NotificationManager", "No notification permission for uid: $uid")
        return
    }

    NotificationManagerCompat.from(context).notify(preview.groupingKey?.hashCode() ?: id, builder.build())
}

private fun showFallbackNotification(
    context: Context,
    uid: String,
    originalPayload: RemoteMessage?,
    reason: String,
    activityEvent: JSONObject? = null
) {
    // Check permissions
    if (ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        Log.w("NotificationManager", "Cannot show fallback notification - no permission")
        return
    }

    val bundle = originalPayload?.toBasicBundle();
    val id = UvParser.getIntCompatibleFromUv(uid)

    // Extract basic info from original payload or use defaults
    val title = bundle?.getString("title") ?: "New message"
    val body = bundle?.getString("body") ?: "You have a new message"

    val extras = Bundle()
    if (activityEvent != null) {
        extras.putString("activityEventJsonString", activityEvent.toString())
    } else if (originalPayload != null) {
        extras.putAll(bundle)
    }
    extras.putString("fallbackReason", reason)

    val tapIntent = Intent(context, MainActivity::class.java)
    tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    tapIntent.replaceExtras(extras)
    val tapPendingIntent = PendingIntent.getActivity(
        context,
        id,
        tapIntent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val builder = NotificationCompat.Builder(context, TalkNotificationManager.CHANNEL_ID)
        .setSmallIcon(R.drawable.notification_icon)
        .setContentTitle(title)
        .setContentText(body)
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .setContentIntent(tapPendingIntent)
        .setAutoCancel(true)
        .addExtras(extras)

    try {
        NotificationManagerCompat.from(context).notify(id, builder.build())
        logNotificationEvent("notification_delivered_fallback", mapOf(
            "uid" to uid,
            "reason" to reason
        ))
        Log.i("NotificationManager", "Showed fallback notification for uid: $uid, reason: $reason")
    } catch (e: Exception) {
        logNotificationEvent("notification_fallback_failed", mapOf(
            "uid" to uid,
            "reason" to reason,
            "error" to e.message.orEmpty()
        ))
        Log.e("NotificationManager", "Failed to show fallback notification", e)
    }
}

fun RemoteMessage.toBasicBundle(): Bundle {
    val bundle = Bundle()

    // Prioritize notification fields, fall back to data fields
    val title = notification?.title ?: data["title"]
    val body = notification?.body ?: data["body"]

    title?.let { bundle.putString("title", it) }
    body?.let { bundle.putString("body", it) }

    // Add essential identifiers
    messageId?.let { bundle.putString("message_id", it) }

    // Add any custom data that might be needed for processing
    data.forEach { (key, value) ->
        bundle.putString(key, value)
    }

    return bundle
}

fun processNotificationBlocking(context: Context, uid: String, originalPayload: RemoteMessage? = null) =
    runBlocking { processNotification(context, uid, originalPayload) }