package io.tlon.landscape.notifications

import android.content.Context
import android.os.Bundle
import com.android.volley.VolleyError
import io.tlon.landscape.api.TalkApi
import io.tlon.landscape.api.TalkObjectCallback
import io.tlon.landscape.utils.UvParser
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
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

    TalkNotificationManager.sendNotification(
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