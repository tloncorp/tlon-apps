package io.tlon.landscape.notifications;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import androidx.core.app.NotificationManagerCompat;
import io.tlon.landscape.R;

public class TalkNotificationManager {

    public static final String CHANNEL_ID = "tlon";

    public static void createNotificationChannel(Context context) {
        CharSequence name = context.getString(R.string.landscape_notification_channel_name);
        String description = context.getString(R.string.landscape_notification_channel_description);
        int importance = NotificationManager.IMPORTANCE_DEFAULT;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
        channel.setDescription(description);
        // Register the channel with the system; you can't change the importance
        // or other notification behaviors after this
        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        notificationManager.createNotificationChannel(channel);
    }

    public static void dismissNotification(Context context, int notificationId) {
        NotificationManagerCompat.from(context).cancel(notificationId);
    }

}
