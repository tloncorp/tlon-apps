package io.tlon.landscape.notifications

import android.util.Log
import com.android.volley.VolleyError
import com.posthog.PostHog

private const val NOTIFICATION_SERVICE_ERROR = "Notification Service Error"
private const val NOTIFICATION_SERVICE_DELIVERED = "Notification Service Delivery Successful"

object NotificationLogger {
    fun logError(e: NotificationException) {
        val properties = getLogPayload(e.uid, e.message ?: "Notification exception", e)
        log(NOTIFICATION_SERVICE_ERROR, properties = properties)
    }

    fun logDelivery(properties: Map<String, Any> = emptyMap()) {
        log(NOTIFICATION_SERVICE_DELIVERED, properties)
    }

    private fun log(eventName: String, properties: Map<String, Any> = emptyMap()) {
        try {
            val enhancedProperties = properties.toMutableMap().apply {
                put("source", "notification_service_extension")
                put("\$lib", "android-notification-extension")
                put("\$lib_version", "1.0.0")
            }
            PostHog.capture(eventName, properties = enhancedProperties)
            Log.i("PostHog", "Event captured: $eventName, $enhancedProperties")
        } catch (e: Exception) {
            Log.d("PostHogFallback", "Event: $eventName, Properties: $properties, Error: ${e.message}")
        }
    }
}

fun getLogPayload(uid: String, message: String, e: Exception? = null): Map<String, Any> {
    val payload = mutableMapOf<String, Any>("uid" to uid, "message" to message)
    if (e != null) {
        // `message` already names the stage that failed, so `e.message` only ever
        // repeated it. What explains a failure is the cause, which used to reach
        // PostHog under `errorType` — a field named for the type but holding the
        // cause. Report the cause as the message and its class as the type.
        val cause = e.cause ?: e
        payload["errorMessage"] = cause.toString()
        payload["errorType"] = cause.javaClass.name
        payload["errorStack"] = Log.getStackTraceString(e)
        cause.httpStatusCode()?.let { payload["httpStatus"] = it }
    }

    return payload
}

/** HTTP status behind this error, when it came from a response. */
private fun Throwable.httpStatusCode(): Int? =
    (this as? VolleyError)?.networkResponse?.statusCode
