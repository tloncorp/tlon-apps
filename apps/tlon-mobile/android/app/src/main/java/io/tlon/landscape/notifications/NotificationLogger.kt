package io.tlon.landscape.notifications

import android.util.Log
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

fun getLogPayload(uid: String, message: String, e: Exception? = null): Map<String, String> {
    val payload = mutableMapOf("uid" to uid, "message" to message);
    if (e != null) {
        payload["errorMessage"] = e.message.orEmpty()
        payload["errorStack"] = e.stackTrace.toString()
        payload["errorType"] = e.cause.toString()
    }

    return payload;
}