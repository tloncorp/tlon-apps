package io.tlon.landscape.notifications;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONException;

import io.tlon.landscape.api.TalkApi;

public class TalkBroadcastReceiver extends BroadcastReceiver {

    public static String MARK_AS_READ_ACTION = "MARK_AS_READ";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent.getAction().equals(TalkBroadcastReceiver.MARK_AS_READ_ACTION)) {
            String channelId = intent.getStringExtra("channelId");
            if (channelId != null) {
                try {
                    new TalkApi(context).pokeChannelReadStatus(channelId, true);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }

                TalkNotificationManager.dismissNotification(context, intent.getIntExtra("notificationId", 0));
            }
        }
    }

}
