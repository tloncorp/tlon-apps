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

suspend fun processNotification(context: Context, uid: String) {
    val api = TalkApi(context)
    val activityEvent = suspendCoroutine { cnt ->
        api.fetchActivityEvent(uid, object: TalkObjectCallback {
            override fun onComplete(response: JSONObject?) = cnt.resume(response)
            override fun onError(error: VolleyError?) = cnt.resumeWithException(error ?: Error("Unknown error"))
        })
    }
    if (activityEvent == null) {
        return
    }

    val preview = renderPreview(context, activityEvent.toString())
    if (preview == null) {
        return
    }

    val extras = Bundle()
    extras.putString("activityEventJsonString", activityEvent.toString())

    val id = UvParser.getIntCompatibleFromUv(uid)
    val person = preview.messagingMetadata?.sender?.person
    val title = preview.title
    val text = preview.body
    val isGroupConversation = preview.messagingMetadata?.isGroupConversation ?: false

    Log.d(
        "NotificationManager",
        "sendNotification: $id $title $text $isGroupConversation"
    )

    val tapIntent = Intent(context, MainActivity::class.java)
    tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    tapIntent.replaceExtras(extras)
    val tapPendingIntent =
        PendingIntent.getActivity(context, id, tapIntent, PendingIntent.FLAG_IMMUTABLE)

    val markAsReadIntent = Intent(
        context,
        TalkBroadcastReceiver::class.java
    )
    markAsReadIntent.setAction(TalkBroadcastReceiver.MARK_AS_READ_ACTION)
    markAsReadIntent.replaceExtras(extras)
    val markAsReadPendingIntent =
        PendingIntent.getBroadcast(
            context,
            id,
            markAsReadIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

    val user =
        Person.Builder().setName(SecureStorage.getString(SecureStorage.SHIP_NAME_KEY)).build()
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
        val notifStyle =
            NotificationCompat.MessagingStyle(user)
                .setGroupConversation(isGroupConversation)
                .setConversationTitle(if (isGroupConversation) title else null)

        // Add all previous messages to notification conversation;
        // also add incoming message to cache.
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

    if (ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        // TODO: Consider calling
        //    ActivityCompat#requestPermissions
        // here to request the missing permissions, and then overriding
        //   public void onRequestPermissionsResult(int requestCode, String[] permissions,
        //                                          int[] grantResults)
        // to handle the case where the user grants the permission. See the documentation
        // for ActivityCompat#requestPermissions for more details.
        return
    }
    NotificationManagerCompat.from(context).notify(preview.groupingKey?.hashCode() ?: id, builder.build())
}

fun processNotificationBlocking(context: Context, uid: String) =
    runBlocking { processNotification(context, uid) }
