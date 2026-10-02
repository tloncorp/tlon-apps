package io.tlon.textselection

import android.os.Bundle
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.TextView
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TlonTextSelectionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TlonTextSelection")

    AsyncFunction("selectAll") { viewTag: Int ->
      // The sheet may have closed between scheduling the command and this UI task.
      val view = runCatching { appContext.findView<View>(viewTag) }.getOrNull() as? TextView
        ?: return@AsyncFunction false
      if (!view.isAttachedToWindow || !view.isTextSelectable || view.text.isEmpty()) {
        return@AsyncFunction false
      }
      view.showSoftInputOnFocus = false
      if (!view.requestFocus()) return@AsyncFunction false
      // Clear a retained range on a quick reopen so setting it restarts selection mode.
      view.performAccessibilityAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, null)
      // This public action sets the range and starts selection mode without a prior touch.
      view.performAccessibilityAction(
        AccessibilityNodeInfo.ACTION_SET_SELECTION,
        Bundle().apply {
          putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, 0)
          putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, view.text.length)
        }
      )
    }.runOnQueue(Queues.MAIN)
  }
}
