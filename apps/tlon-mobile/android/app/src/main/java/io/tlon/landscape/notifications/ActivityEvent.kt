package io.tlon.landscape.notifications

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.android.volley.VolleyError
import io.tlon.landscape.api.TalkApi
import io.tlon.landscape.api.TalkObjectCallback
import io.tlon.landscape.models.Contact
import io.tlon.landscape.notifications.PreviewContentNode.ChannelTitle
import io.tlon.landscape.notifications.PreviewContentNode.ConcatenateStrings
import io.tlon.landscape.notifications.PreviewContentNode.StringLiteral
import kotlinx.coroutines.*
import org.json.JSONObject
import kotlin.coroutines.*

data class ActivityEventPreviewMessage(
    val sender: Contact,
    val isGroupConversation: Boolean,
)
data class ActivityEventPreview(
    val title: String?,
    val body: String?,

    // present when event represents a user-to-user message
    val messagingMetadata: ActivityEventPreviewMessage?,
)

@SuppressLint("SetJavaScriptEnabled")
suspend fun renderPreview(context: Context, activityEventJson: String): ActivityEventPreview? = withContext(Dispatchers.Main.immediate) {
    val scriptSrc = withContext(Dispatchers.IO) {
        context.assets.open("bundle.jsbundle").bufferedReader().use { it.readText() }
    }

    val webView = WebView(context)
    webView.settings.javaScriptEnabled = true

    // Inject a Java-JS interfacing object into JS so we can cleanly access the string in JS
    // without needing to add escape characters.
    webView.addJavascriptInterface(object {
        @JavascriptInterface
        fun asJson(): String {
            return activityEventJson;
        }
    }, "__data")

    webView.evaluateJavascript(scriptSrc, null)
    suspendCancellableCoroutine { cnt ->
        webView.evaluateJavascript("tlon.renderActivityEventPreview(JSON.parse(__data.asJson()))") { result ->
            when (result) {
                "null" -> cnt.resume(null)
                else -> launch {
                    val renderer = PreviewContentNodeRenderer(TalkApi(context))
                    val parsed = PreviewContentPayload.parseFromJson(JSONObject(result))
                    val contact = suspendCoroutine { cnt ->
                        parsed.message?.let { m ->
                            TalkApi(context).fetchContact(m.senderId, object: TalkObjectCallback {
                                override fun onComplete(response: JSONObject?) =
                                    cnt.resume(Contact(m.senderId, response))
                                override fun onError(error: VolleyError?) =
                                    cnt.resumeWithException(error ?: Error("Unknown error"))
                            })
                        }
                    }
                    val preview = ActivityEventPreview(
                        title = parsed.notification.title?.let { x -> renderer.render(x) },
                        body = renderer.render(parsed.notification.body),
                        messagingMetadata = parsed.message?.let { m ->
                            ActivityEventPreviewMessage(
                                sender = contact,
                                isGroupConversation = m.isGroupConversation
                            )
                        }
                    )
                    cnt.resume(preview)
                }
            }
        }
    }
}

private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

fun renderPreviewAsync(context: Context, activityEventJson: String, onSuccess: java.util.function.Consumer<ActivityEventPreview?>) {
    serviceScope.launch {
        val preview = renderPreview(context, activityEventJson)
        onSuccess.accept(preview)
    }
}

data class PreviewContentPayload(
    val notification: NotificationPayload,
    val message: MessagePayload?
) {
    data class NotificationPayload(
        val title: PreviewContentNode?,
        val body: PreviewContentNode,
        val groupingKey: PreviewContentNode?,
    )
    data class MessagePayload(
        val isGroupConversation: Boolean,
        val timestamp: Number,
        val senderId: String,
        val conversationTitle: PreviewContentNode,
        val messageText: PreviewContentNode,
    )
    companion object {
        private fun parseNodeAtKey(source: JSONObject, key: String): PreviewContentNode =
            PreviewContentNode.parseFromJson(source.getJSONObject(key))
        private fun maybeParseNodeAtKey(source: JSONObject, key: String): PreviewContentNode? =
            if (source.has(key)) parseNodeAtKey(source, key) else null

        fun parseFromJson(source: JSONObject): PreviewContentPayload = PreviewContentPayload(
            notification = source.getJSONObject("notification").let { source ->
                NotificationPayload(
                    title = maybeParseNodeAtKey(source, "title"),
                    body = parseNodeAtKey(source, "body"),
                    groupingKey = maybeParseNodeAtKey(source, "groupingKey"),
                )
            },
            message = source.getJSONObject("message").let { source ->
                MessagePayload(
                    isGroupConversation = source.getString("type") == "group",
                    timestamp = source.getDouble("timestamp"),
                    senderId = source.getString("senderId"),
                    conversationTitle = parseNodeAtKey(source, "conversationTitle"),
                    messageText = parseNodeAtKey(source, "messageText"),
                )
            }
        )
    }
}

sealed class PreviewContentNode {
    data class StringLiteral(val content: String) : PreviewContentNode()
    data class ConcatenateStrings(val first: PreviewContentNode, val second: PreviewContentNode) : PreviewContentNode()
    data class ChannelTitle(val channelId: String) : PreviewContentNode()

    companion object {
        fun parseFromJson(source: JSONObject): PreviewContentNode =
            when (source.getString("type")) {
                "stringLiteral" -> StringLiteral(source.getString("content"))
                "concatenateStrings" -> ConcatenateStrings(
                    parseFromJson(source.getJSONObject("first")),
                    parseFromJson(source.getJSONObject("second"))
                )
                "channelTitle" -> ChannelTitle(source.getString("channelId"))
                else -> throw Error("Unrecognized PreviewContentNode from JS")
            }
    }
}

class PreviewContentNodeRenderer(private val api: TalkApi) {
    suspend fun render(node: PreviewContentNode): String =
        when (node) {
            is StringLiteral -> node.content
            is ConcatenateStrings -> render(node.first) + render(node.second)
            is ChannelTitle -> api.fetchChannelTitle(node.channelId) ?: node.channelId
        }
}

private suspend fun TalkApi.fetchChannelTitle(channelId: String): String? {
    val response = suspendTalkObjectCallback { cb -> fetchGroupChannel(channelId, cb) }
    return response?.getJSONObject("meta")?.getString("title")
}

suspend fun suspendTalkObjectCallback(perform: (callback: TalkObjectCallback) -> Unit) =
    suspendCoroutine { cnt ->
        perform(object : TalkObjectCallback {
            override fun onComplete(response: JSONObject?) =
                cnt.resume(response)
            override fun onError(error: VolleyError?) =
                cnt.resumeWithException(error ?: Error("Unknown error"))
        })
    }