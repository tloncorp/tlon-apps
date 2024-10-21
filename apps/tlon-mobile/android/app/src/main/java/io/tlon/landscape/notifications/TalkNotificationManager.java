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
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Date;
import java.util.Iterator;

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
        Log.d("TalkNotificationManager", "handleNotification: " + uid);
        // Disabled for now, was causing issues with notifications not showing up
        // while the app wasn't in the foreground (or even when it was killed)
        // Skip showing notifications when app is in foreground
        // if (AppLifecycleManager.isInForeground) {
        // Log.d("TalkNotificationManager", "App is in foreground, skipping notification");
        // return;
        // }

        final TalkApi api = new TalkApi(context);
        final int id = UvParser.getIntCompatibleFromUv(uid);
        Log.d("TalkNotificationManager", "fetching yarn: " + uid + " " + id);
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

                Log.d("TalkNotificationManager", "handleNotification, yarn: " + yarn.toString());

                // Skip if not a valid push notification
                if (!yarn.isValidNotification) {
                  Log.d("TalkNotificationManager", "Invalid notification, skipping");
                    return;
                }

                Log.d("TalkNotificationManager", "fetching contact: " + yarn.senderId);
                api.fetchContact(yarn.senderId, new TalkObjectCallback() {
                    @Override
                    public void onComplete(JSONObject response) {
                        final Contact contact = new Contact(yarn.senderId, response);
                        final String channelId = yarn.channelId.orElse("");
                        Log.d("TalkNotificationManager", "handleNotification, contact: " + contact.toString());
                        createNotificationTitle(api, yarn, contact, title -> {
                            Bundle data = new Bundle();
                            data.putString("wer", yarn.wer);
                            data.putString("channelId", channelId);
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
        if (yarn.isGroup && yarn.channelId.isPresent()) {
            final String fallbackTitle = yarn.channelId.get().replace("chat/", "");
            api.fetchGroupChannel(yarn.channelId.get(), new TalkObjectCallback() {
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

        if (yarn.isGroup && yarn.groupId.isPresent() && !yarn.channelId.isPresent()) {
            // this only works for group invites, if we start handling other events, we need to
            // also fetch groups and prioritize that metadata over gangs
            api.fetchGangs(new TalkObjectCallback() {
                final String groupId = yarn.groupId.get();
                @Override
                public void onComplete(JSONObject response) {
                    try {
                        JSONObject group = response.getJSONObject(groupId);
                        if (group.isNull("preview")) {
                            callback.onComplete(groupId);
                            return;
                        }

                        String title = group.getJSONObject("preview").getJSONObject("meta").getString("title");
                        callback.onComplete(title.isEmpty() ? groupId : title);
                    } catch (JSONException e) {
                        callback.onComplete(groupId);
                    }
                }

                @Override
                public void onError(VolleyError error) {
                    ReactNativeFirebaseCrashlyticsNativeHelper.recordNativeException(new Exception("notifications_fetch_groups", error));
                    callback.onComplete(groupId);
                }
            });

            return;
        }

        if (yarn.isClub && yarn.channelId.isPresent()) {
            api.fetchClub(yarn.channelId.get(), new TalkObjectCallback() {
                @Override
                public void onComplete(JSONObject response) {
                    Club club = new Club(yarn.channelId.get(), response);
                    callback.onComplete(club.displayName);
                }

                @Override
                public void onError(VolleyError error) {
                    ReactNativeFirebaseCrashlyticsNativeHelper.recordNativeException(new Exception("notifications_fetch_club", error));
                    callback.onComplete(yarn.channelId.get());
                }
            });
            return;
        }

        callback.onComplete(contact.displayName);
    }

    private static void sendNotification(Context context, int id, Person person, String title, String text, Boolean isGroupConversation, Bundle data) {
        Log.d("TalkNotificationManager", "sendNotification: " + id + " " + title + " " + text + " " + isGroupConversation);
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
