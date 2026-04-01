package io.tlon.landscape

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import expo.modules.backgroundtask.BackgroundTaskScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class DebugBgSyncReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "DebugBgSyncReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()
        Log.i(TAG, "Received broadcast, triggering background sync")
        CoroutineScope(Dispatchers.Default).launch {
            try {
                BackgroundTaskScheduler.runTasks(
                    context.applicationContext,
                    context.applicationContext.packageName
                )
                Log.i(TAG, "Background sync completed")
            } catch (e: Exception) {
                Log.e(TAG, "Background sync failed: ${e.message}", e)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
