package io.tlon.landscape.notifications

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.core.app.NotificationCompat
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

    sendNotification(
        context,
        UvParser.getIntCompatibleFromUv(uid),
        preview.messagingMetadata?.sender?.person,
        preview.title,
        preview.body,
        preview.messagingMetadata?.isGroupConversation ?: false,
        extras
    )
}

fun processNotificationBlocking(context: Context, uid: String) =
    runBlocking { processNotification(context, uid) }

fun sendNotification(
    context: Context,
    id: Int,
    person: Person?,
    title: String?,
    text: String?,
    isGroupConversation: Boolean,
    data: Bundle?
) {
    Log.d(
        "TalkNotificationManager",
        "sendNotification: $id $title $text $isGroupConversation"
    )
    val tapIntent = Intent(context, MainActivity::class.java)
    tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    tapIntent.replaceExtras(data)
    val tapPendingIntent =
        PendingIntent.getActivity(context, id, tapIntent, PendingIntent.FLAG_IMMUTABLE)

    val markAsReadIntent = Intent(
        context,
        TalkBroadcastReceiver::class.java
    )
    markAsReadIntent.setAction(TalkBroadcastReceiver.MARK_AS_READ_ACTION)
    markAsReadIntent.replaceExtras(data)
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
            .addExtras(data)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(tapPendingIntent)
            .addAction(
                R.drawable.ic_mark_as_read,
                context.getString(R.string.landscape_notification_mark_as_read),
                markAsReadPendingIntent
            )
            .setAutoCancel(true)

    if (person != null) {
        builder
            .setStyle(
                NotificationCompat.MessagingStyle(user)
                    .setGroupConversation(isGroupConversation)
                    .setConversationTitle(if (isGroupConversation) title else null)
                    .addMessage(text, Date().time, person)
            )
    }

    NotificationManagerCompat.from(context).notify(id, builder.build())
}
