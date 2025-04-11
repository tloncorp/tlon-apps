package io.tlon.landscape.notifications

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.os.bundleOf
import kotlinx.coroutines.*
import org.json.JSONException
import org.json.JSONObject
import kotlin.coroutines.*

data class ActivityEventPreview(
    val title: String?,
    val body: String?,
    val userInfo: Bundle
)

private fun JSONObject.maybeString(name: String): String? =
    if (this.has(name)) this.getString(name) else null

private fun JSONObject.toBundle(): Bundle {
    val entries = this.keys().asSequence().map { k -> Pair(k, this.get(k)) }.toList().toTypedArray()
    return bundleOf(*entries)
}

@SuppressLint("SetJavaScriptEnabled")
suspend fun renderPreview(context: Context, activityEventJson: String): ActivityEventPreview? = withContext(Dispatchers.Main.immediate) {
    val scriptSrc = withContext(Dispatchers.IO) {
        context.assets.open("bundle.jsbundle").bufferedReader().use { it.readText() }
    }

    suspendCancellableCoroutine { cnt ->
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
        webView.evaluateJavascript("tlon.renderActivityEventPreview(JSON.parse(__data.asJson()))") { result ->
            when (result) {
                "null" -> cnt.resume(null)
                else -> try {
                    val parsed = JSONObject(result)
                    val preview = ActivityEventPreview(
                        title = parsed.maybeString("title"),
                        body = parsed.maybeString("body"),
                        userInfo = parsed.getJSONObject("userInfo").toBundle()
                    )
                    cnt.resume(preview)
                } catch (e: JSONException) {
                    cnt.cancel(IllegalArgumentException("Expected a JSON string or null, but got: $result", e))
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