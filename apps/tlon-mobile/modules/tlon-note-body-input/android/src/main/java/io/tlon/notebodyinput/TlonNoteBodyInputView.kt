package io.tlon.notebodyinput

import android.content.Context
import android.graphics.Typeface
import android.net.Uri
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.TypedValue
import android.view.ActionMode
import android.view.Gravity
import android.view.Menu
import android.view.MenuItem
import android.view.inputmethod.InputMethodManager
import android.webkit.MimeTypeMap
import androidx.appcompat.widget.AppCompatEditText
import androidx.core.view.ViewCompat
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.io.IOException
import java.util.UUID
import kotlin.math.min

class TlonNoteBodyInputView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  private val onBodyChange by EventDispatcher()
  private val onBodySelectionChange by EventDispatcher()
  private val onBodyFocus by EventDispatcher()
  private val onBodyBlur by EventDispatcher()
  private val onMenuItemPress by EventDispatcher()
  private val onPasteImages by EventDispatcher()

  var menuItems: List<NoteBodyMenuItem> = emptyList()
  var acceptsImagePaste = false

  private var eventCount = 0
  private var lastSelectionRequestId = 0
  private var applyingValue = false

  val editText = NoteBodyEditText(context).apply {
    background = null
    setPadding(0, 0, 0, 0)
    gravity = Gravity.TOP or Gravity.START
    inputType = InputType.TYPE_CLASS_TEXT or
      InputType.TYPE_TEXT_FLAG_MULTI_LINE or
      InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or
      InputType.TYPE_TEXT_FLAG_AUTO_CORRECT
    typeface = Typeface.MONOSPACE
    isVerticalScrollBarEnabled = false
  }

  init {
    addView(editText, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

    editText.addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
      override fun afterTextChanged(s: Editable?) {
        if (applyingValue) return
        eventCount += 1
        onBodyChange(mapOf("text" to (s?.toString() ?: ""), "eventCount" to eventCount))
      }
    })
    editText.onSelectionChange = { start, end ->
      onBodySelectionChange(mapOf("start" to start, "end" to end))
    }
    editText.setOnFocusChangeListener { _, hasFocus ->
      if (hasFocus) onBodyFocus(mapOf()) else onBodyBlur(mapOf())
    }

    val menuCallback = object : ActionMode.Callback {
      override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
        if (editText.isFocusable) {
          menuItems.forEachIndexed { index, item ->
            menu.add(Menu.NONE, MENU_ITEM_ID_BASE + index, MENU_ITEM_ORDER + index, item.title)
          }
        }
        return true
      }

      override fun onPrepareActionMode(mode: ActionMode, menu: Menu) = false

      override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean {
        if (item.itemId == android.R.id.paste) {
          // A paste taken by the receive-content listener leaves the menu up.
          editText.onTextContextMenuItem(item.itemId)
          mode.finish()
          return true
        }
        val entry = menuItems.getOrNull(item.itemId - MENU_ITEM_ID_BASE) ?: return false
        onMenuItemPress(mapOf("id" to entry.id))
        mode.finish()
        return true
      }

      override fun onDestroyActionMode(mode: ActionMode) = Unit
    }
    editText.customInsertionActionModeCallback = menuCallback
    editText.customSelectionActionModeCallback = menuCallback

    // AppCompat routes the Paste menu item, keyboard image insertion and drops
    // through this listener; anything that isn't an image goes back to the
    // default handling, so text still pastes as text.
    ViewCompat.setOnReceiveContentListener(editText, arrayOf("image/*")) { _, payload ->
      if (!acceptsImagePaste) return@setOnReceiveContentListener payload
      val split = payload.partition { item -> item.uri?.let(::isImage) == true }
      split.first?.let { images ->
        copyImages((0 until images.clip.itemCount).mapNotNull { images.clip.getItemAt(it).uri })
      }
      split.second
    }
  }

  fun apply(value: NoteBodyValue) {
    if (value.eventCount < eventCount) return
    val text = editText.text?.toString() ?: ""
    if (value.text != text) {
      val selection = editText.selectionStart
      applyingValue = true
      editText.setText(value.text)
      applyingValue = false
      editText.setSelection(selection.coerceIn(0, value.text.length))
    }
    val start = value.selectionStart
    if (value.selectionRequestId != lastSelectionRequestId && start != null) {
      lastSelectionRequestId = value.selectionRequestId
      val length = editText.length()
      val end = maxOf(start, value.selectionEnd ?: start)
      editText.setSelection(min(start, length), min(end, length))
    }
  }

  fun setFontSize(size: Float) {
    editText.setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
  }

  fun setLineHeight(lineHeight: Float) {
    if (lineHeight <= 0) return
    val px = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, lineHeight, resources.displayMetrics)
    editText.setLineHeight(px.toInt())
  }

  fun setEditable(editable: Boolean) {
    editText.isFocusable = editable
    editText.isFocusableInTouchMode = editable
    editText.isCursorVisible = editable
  }

  fun focusInput() {
    if (!editText.requestFocus()) return
    val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    imm.showSoftInput(editText, InputMethodManager.SHOW_IMPLICIT)
  }

  private fun isImage(uri: Uri) =
    context.contentResolver.getType(uri)?.startsWith("image/") == true

  // Content URIs from the clipboard or keyboard are only readable for a short
  // while, so each image is copied into the cache before it is reported.
  private fun copyImages(uris: List<Uri>) {
    Thread {
      val files = uris.mapNotNull(::copyToCache)
      post {
        onPasteImages(mapOf("files" to files, "failedCount" to uris.size - files.size))
      }
    }.start()
  }

  private fun copyToCache(uri: Uri): Map<String, Any>? {
    val resolver = context.contentResolver
    val mimeType = resolver.getType(uri) ?: return null
    val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "img"
    val directory = File(context.cacheDir, "note-paste").apply { mkdirs() }
    val file = File(directory, "${UUID.randomUUID()}.$extension")
    return try {
      val input = resolver.openInputStream(uri) ?: return null
      input.use { stream -> file.outputStream().use { stream.copyTo(it) } }
      mapOf(
        "uri" to Uri.fromFile(file).toString(),
        "type" to mimeType,
        "fileName" to file.name,
        "fileSize" to file.length().toDouble()
      )
    } catch (e: IOException) {
      null
    } catch (e: SecurityException) {
      null
    }
  }

  companion object {
    private const val MENU_ITEM_ID_BASE = 0x7e57_0000
    private const val MENU_ITEM_ORDER = 100
  }
}

class NoteBodyEditText(context: Context) : AppCompatEditText(context) {
  var onSelectionChange: ((Int, Int) -> Unit)? = null

  override fun onSelectionChanged(selStart: Int, selEnd: Int) {
    super.onSelectionChanged(selStart, selEnd)
    onSelectionChange?.invoke(selStart, selEnd)
  }
}
