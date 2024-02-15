package io.tlon.landscape.notifications;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;

import com.android.volley.TimeoutError;
import com.android.volley.VolleyError;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Date;

import io.invertase.firebase.crashlytics.ReactNativeFirebaseCrashlyticsNativeHelper;
import io.tlon.landscape.AppLifecycleManager;
import io.tlon.landscape.MainActivity;
import io.tlon.landscape.R;
import io.tlon.landscape.api.TalkApi;
import io.tlon.landscape.api.TalkObjectCallback;
import io.tlon.landscape.models.Club;
import io.tlon.landscape.models.Contact;
import io.tlon.landscape.models.Yarn;
import io.tlon.landscape.storage.SecureStorage;
import io.tlon.landscape.utils.UvParser;

public class TalkNotificationManager {

    private static final String CHANNEL_ID = "tlon";

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

    public static void handleNotification(Context context, String uid) {
        // Skip showing notifications when app is in foreground
        if (AppLifecycleManager.isInForeground) {
            return;
        }

        final TalkApi api = new TalkApi(context);
        final int id = UvParser.getIntCompatibleFromUv(uid);
        api.fetchYarn(uid, new TalkObjectCallback() {
            @Override
            public void onComplete(JSONObject response) {
                final Yarn yarn;
                try {
                    yarn = new Yarn(response);
                } catch (JSONException e) {
                    ReactNativeFirebaseCrashlyticsNativeHelper.recordNativeException(new Exception("notifications_fetch_yarn", e));
                    return;
                }

                // Skip if not a valid push notification
                if (!yarn.isValidNotification) {
                    return;
                }

                api.fetchContact(yarn.senderId, new TalkObjectCallback() {
                    @Override
                    public void onComplete(JSONObject response) {
                        final Contact contact = new Contact(yarn.senderId, response);
                        createNotificationTitle(api, yarn, contact, title -> {
                            Bundle data = new Bundle();
                            data.putString("wer", yarn.wer);
                            data.putString("channelId", yarn.channelId);
                            data.putInt("notificationId", id);
                            sendNotification(
                                    context,
                                    id,
                                    contact.person,
                                    title,
                                    yarn.contentText,
                                    yarn.isGroup || yarn.isClub,
                                    data);
                        });
                    }

                    @Override
                    public void onError(VolleyError error) {
                        ReactNativeFirebaseCrashlyticsNativeHelper.recordNativeException(new Exception("notifications_fetch_contacts", error));
                    }
                });
            }

            @Override
            public void onError(VolleyError error) {
                ReactNativeFirebaseCrashlyticsNativeHelper.recordNativeException(new Exception("notifications_fetch_yarn", error));
                if (error instanceof TimeoutError) {
                    sendFallbackNotification(context);
                }
            }
        });
    }

    private static void createNotificationTitle(TalkApi api, Yarn yarn, Contact contact, TalkNotificationContentCallback callback) {
        if (yarn.isGroup) {
            final String fallbackTitle = yarn.channelId.replace("chat/", "");
            api.fetchGroupChannel(yarn.channelId, new TalkObjectCallback() {
                @Override
                public void onComplete(JSONObject response) {
                    try {
                        String title = response.getJSONObject("meta").getString("title");
                        callback.onComplete(title);
                    } catch (JSONException e) {
                        callback.onComplete(fallbackTitle);
                    }
                }

                @Override
                public void onError(VolleyError error) {
                    ReactNativeFirebaseCrashlyticsNativeHelper.recordNativeException(new Exception("notifications_fetch_group_channel", error));
                    callback.onComplete(fallbackTitle);
                }
            });
            return;
        }

        if (yarn.isClub) {
            api.fetchClub(yarn.channelId, new TalkObjectCallback() {
                @Override
                public void onComplete(JSONObject response) {
                    Club club = new Club(yarn.channelId, response);
                    callback.onComplete(club.displayName);
                }

                @Override
                public void onError(VolleyError error) {
                    ReactNativeFirebaseCrashlyticsNativeHelper.recordNativeException(new Exception("notifications_fetch_club", error));
                    callback.onComplete(yarn.channelId);
                }
            });
            return;
        }

        callback.onComplete(contact.displayName);
    }

    private static void sendNotification(Context context, int id, Person person, String title, String text, Boolean isGroupConversation, Bundle data) {
        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        tapIntent.replaceExtras(data);
        PendingIntent tapPendingIntent =
                PendingIntent.getActivity(context, id, tapIntent, PendingIntent.FLAG_IMMUTABLE);

        Intent markAsReadIntent = new Intent(context, TalkBroadcastReceiver.class);
        markAsReadIntent.setAction(TalkBroadcastReceiver.MARK_AS_READ_ACTION);
        markAsReadIntent.replaceExtras(data);
        PendingIntent markAsReadPendingIntent =
                PendingIntent.getBroadcast(context, id, markAsReadIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Person user = new Person.Builder().setName(SecureStorage.getString(SecureStorage.SHIP_NAME_KEY)).build();
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.notification_icon)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.MessagingStyle(user)
                        .setGroupConversation(isGroupConversation)
                        .setConversationTitle(isGroupConversation ? title : null)
                        .addMessage(text, new Date().getTime(), person))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(tapPendingIntent)
                .addAction(R.drawable.ic_mark_as_read, context.getString(R.string.landscape_notification_mark_as_read), markAsReadPendingIntent)
                .setAutoCancel(true);
        NotificationManagerCompat.from(context).notify(id, builder.build());
    }

    private static void sendFallbackNotification(Context context) {
        Bundle data = new Bundle();
        data.putString("wer", "/notifications");

        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        tapIntent.replaceExtras(data);
        PendingIntent tapPendingIntent =
                PendingIntent.getActivity(context, 0, tapIntent, PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.notification_icon)
                .setContentText("You have received a notification.")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(tapPendingIntent)
                .setAutoCancel(true);
        NotificationManagerCompat.from(context).notify(0, builder.build());
    }

    public static void dismissNotification(Context context, int notificationId) {
        NotificationManagerCompat.from(context).cancel(notificationId);
    }

}
