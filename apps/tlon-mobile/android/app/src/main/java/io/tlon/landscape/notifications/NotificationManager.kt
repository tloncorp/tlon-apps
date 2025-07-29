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

const val MAX_CACHED_CONVERSATION_LENGTH = 15
val notificationMessagesCache = HashMap<String, Array<NotificationCompat.MessagingStyle.Message>>();

private const val NOTIFICATION_MANAGER = "NotificationManager"

suspend fun processNotification(context: Context, uid: String) {
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
        throw ActivityEventFetchFailed(uid, e);
    }

    if (activityEvent == null) {
        throw ActivityEventMissing(uid);
    }

    val activityEventJSON = activityEvent.toString()
    val preview = try {
        renderPreview(context, activityEventJSON)
    } catch (e: Exception) {
        throw PreviewRenderFailed(uid, activityEventJSON, e)
    }

    if (preview == null) {
        throw PreviewEmpty(uid, activityEventJSON)
    }

    try {
        // Proceed with rich notification
        val extras = Bundle()
        extras.putString("activityEventJsonString", activityEventJSON)

        showRichNotification(context, uid, preview, extras)
        NotificationLogger.logDelivery(mapOf("uid" to uid, "message" to "Rich notification delivered"))
    } catch (e: Exception) {
        throw RichNotificationDisplayFailed(uid, activityEventJSON, e);
    }
}

private fun showRichNotification(context: Context, uid: String, preview: ActivityEventPreview, extras: Bundle) {
    val id = UvParser.getIntCompatibleFromUv(uid)
    // Check permissions
    if (ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        NotificationLogger.logError(
            NotificationException(
                uid,
                "Lacking notification permissions"
            )
        )
        Log.w(NOTIFICATION_MANAGER, "Cannot show notification - no permission")
        return
    }

    val builder: NotificationCompat.Builder = NotificationCompat.Builder(context, TalkNotificationManager.CHANNEL_ID)
        .buildMessagingTappable(context, id, extras)

    val markAsReadIntent = Intent(context, TalkBroadcastReceiver::class.java)
    markAsReadIntent.setAction(TalkBroadcastReceiver.MARK_AS_READ_ACTION)
    markAsReadIntent.replaceExtras(extras)
    val markAsReadPendingIntent = PendingIntent.getBroadcast(
        context,
        id,
        markAsReadIntent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val person = preview.messagingMetadata?.sender?.person
    val title = preview.title
    val text = preview.body
    val isGroupConversation = preview.messagingMetadata?.isGroupConversation ?: false

    Log.d(NOTIFICATION_MANAGER, "sendNotification: $id $title $text $isGroupConversation")

    val user = Person.Builder().setName(SecureStorage.getString(SecureStorage.SHIP_NAME_KEY)).build()

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

    builder
        .setContentTitle(title)
        .setContentText(text)
        .setGroup(preview.groupingKey)
        .addAction(
            R.drawable.ic_mark_as_read,
            context.getString(R.string.landscape_notification_mark_as_read),
            markAsReadPendingIntent
        )
    NotificationManagerCompat.from(context).notify(preview.groupingKey?.hashCode() ?: id, builder.build())
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

fun NotificationCompat.Builder.buildMessagingTappable(context: Context, id: Int, extras: Bundle): NotificationCompat.Builder {
    val tapIntent = Intent(context, MainActivity::class.java)
    tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    tapIntent.replaceExtras(extras)
    val tapPendingIntent =  PendingIntent.getActivity(
        context,
        id,
        tapIntent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val builder =  this
            .setSmallIcon(R.drawable.notification_icon)
            .addExtras(extras)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(tapPendingIntent)
            .setAutoCancel(true)

    return builder
}

fun processNotificationBlocking(context: Context, uid: String) =
    runBlocking { processNotification(context, uid) }

open class NotificationException(
    message: String,
    val uid: String,
    val activityEvent: String? = null,
    cause: Throwable? = null
): Exception(message, cause)

class ActivityEventFetchFailed(
    uid: String,
    cause: Throwable? = null
): NotificationException("Activity event fetch failed", uid, null, cause)

class ActivityEventMissing(
    uid: String,
    cause: Throwable? = null
): NotificationException("Activity event fetch failed", uid, null, cause)

class PreviewRenderFailed(
    uid: String,
    activityEvent: String,
    cause: Throwable? = null
): NotificationException("Preview render failed", uid, activityEvent, cause)

class PreviewEmpty(
    uid: String,
    activityEvent: String,
): NotificationException("Preview is null", uid, activityEvent)

class RichNotificationDisplayFailed(
    uid: String,
    activityEvent: String,
    cause: Throwable? = null
): NotificationException("Rich notification display failed", uid, activityEvent, cause)