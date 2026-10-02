package io.tlon.landscape.notifications;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import org.json.JSONException;

import io.tlon.landscape.api.TalkApi;

public class TalkBroadcastReceiver extends BroadcastReceiver {

    private static final String TAG = "TalkBroadcastReceiver";

    public static String MARK_AS_READ_ACTION = "MARK_AS_READ";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!MARK_AS_READ_ACTION.equals(intent.getAction())) {
            return;
        }

        String readSource = intent.getStringExtra("readSource");
        if (readSource == null) {
            // the action is only attached to notifications that carry a source,
            // so this means a stale pending intent from an older build
            Log.w(TAG, "Mark as read with no read source; ignoring");
            return;
        }

        int notificationId = intent.getIntExtra("notificationId", 0);
        String groupingKey = intent.getStringExtra("groupingKey");

        // dismiss up front so the action feels immediate; the ship pushes its
        // own dismiss for the source once the read lands, which prunes any
        // sibling notifications we don't know about here
        TalkNotificationManager.dismissNotification(context, notificationId);
        if (groupingKey != null) {
            NotificationMessagesCache.INSTANCE.clearConversation(groupingKey);
        }

        // onReceive's process can be killed as soon as it returns, which would
        // cut the poke off mid-flight — hold the receiver open until it lands
        PendingResult pendingResult = goAsync();
        try {
            new TalkApi(context).pokeActivityRead(readSource, succeeded -> {
                if (!succeeded) {
                    Log.w(TAG, "Failed to mark " + readSource + " as read");
                }
                pendingResult.finish();
            });
        } catch (JSONException e) {
            Log.e(TAG, "Malformed read source: " + readSource, e);
            pendingResult.finish();
        }
    }

}
