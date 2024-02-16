package io.tlon.landscape;

import android.annotation.SuppressLint;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.Objects;

import io.tlon.landscape.notifications.TalkNotificationManager;

@SuppressLint("MissingFirebaseInstanceTokenRefresh")
public class TalkMessagingService extends FirebaseMessagingService {

    /**
     * Called when message is received.
     *
     * @param remoteMessage Object representing the message received from Firebase Cloud Messaging.
     */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        // Check if message contains a data payload.
        if (remoteMessage.getData().size() > 0) {
            Map<String, String> data = remoteMessage.getData();
            if (Objects.equals(data.get("action"), "notify")) {
                TalkNotificationManager.handleNotification(this, data.get("uid"));
            }
        }
    }

}
