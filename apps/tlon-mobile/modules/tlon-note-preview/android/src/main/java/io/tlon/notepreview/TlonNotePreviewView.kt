package io.tlon.notepreview

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class TlonNotePreviewView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  private val onContentHeight by EventDispatcher()
  private val onPressLink by EventDispatcher()
  private val onPressMention by EventDispatcher()
  private val onPressImage by EventDispatcher()
  private val onPressVideo by EventDispatcher()

  private var blocks by mutableStateOf<List<NoteBlock>>(emptyList())
  private var theme by mutableStateOf(NoteTheme())
  private var reportedHeight = -1f

  private val composeView = ComposeView(context).apply {
    setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
    setContent {
      NotePreviewContent(
        blocks = blocks,
        theme = theme,
        callbacks = NotePreviewCallbacks(
          onLink = { url -> onPressLink(mapOf("url" to url)) },
          onMention = { contactId -> onPressMention(mapOf("contactId" to contactId)) },
          onImage = { src -> onPressImage(mapOf("src" to src)) },
          onVideo = { src, posterUri ->
            onPressVideo(
              if (posterUri != null) mapOf("src" to src, "posterUri" to posterUri)
              else mapOf("src" to src)
            )
          },
          onHeight = ::reportHeight
        )
      )
    }
  }

  // React Native measures the view before it is in a window, and a ComposeView
  // can't compose without one, so it joins on attach.
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (composeView.parent == null) {
      addView(composeView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }
  }

  fun setDocument(json: String) {
    blocks = NoteDocumentParser.parseBlocks(json)
  }

  fun setTheme(json: String) {
    theme = NoteDocumentParser.parseTheme(json)
  }

  // JS sizes this view from the content, which the content measures without
  // the view's current height as a bound.
  private fun reportHeight(height: Float) {
    if (height == reportedHeight) return
    reportedHeight = height
    onContentHeight(mapOf("height" to height))
  }
}
