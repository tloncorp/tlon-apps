package io.tlon.notepreview

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Outline
import android.view.View
import android.view.ViewOutlineProvider
import android.widget.ImageView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.selection.DisableSelection
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.bumptech.glide.Glide
import kotlinx.coroutines.delay

class NotePreviewCallbacks(
  val onLink: (String) -> Unit,
  val onMention: (String) -> Unit,
  val onImage: (String) -> Unit,
  val onVideo: (src: String, posterUri: String?) -> Unit,
  val onHeight: (Float) -> Unit
)

// Matches the React renderer: each block is padded 12 on every side, so blocks
// sit 24 apart with 12 above the first and below the last.
private val BlockEdge = 12.dp
private val BlockGap = 24.dp
private val ListItemGap = 4.dp
private val IndentStep = 24.dp
private val MarkerWidth = 18.dp
private val MarkerGap = 6.dp
private val Corner = 6.dp

@Composable
fun NotePreviewContent(
  blocks: List<NoteBlock>,
  theme: NoteTheme,
  callbacks: NotePreviewCallbacks
) {
  val density = LocalDensity.current
  // One container, so a single selection spans every block.
  SelectionContainer {
    Column(
      Modifier
        .fillMaxWidth()
        .wrapContentHeight(align = Alignment.Top, unbounded = true)
        .onSizeChanged { callbacks.onHeight(it.height / density.density) }
        .padding(vertical = BlockEdge)
    ) {
      blocks.forEachIndexed { index, block ->
        if (index > 0) {
          val listRun = isListItem(blocks[index - 1]) && isListItem(block) &&
            !(block as NoteBlock.Text).listStart
          Spacer(Modifier.height(if (listRun) ListItemGap else BlockGap))
        }
        NoteBlockView(block, theme, callbacks)
      }
    }
  }
}

private fun isListItem(block: NoteBlock) = block is NoteBlock.Text && block.indent != null

@Composable
private fun NoteBlockView(block: NoteBlock, theme: NoteTheme, callbacks: NotePreviewCallbacks) {
  when (block) {
    is NoteBlock.Text -> TextBlockView(block, theme, callbacks)
    is NoteBlock.Code -> CodeBlockView(block, theme)
    is NoteBlock.Image -> RemoteImage(
      src = block.src,
      aspect = aspectOf(block.width, block.height),
      modifier = Modifier,
      onPress = { callbacks.onImage(block.src) }
    )
    is NoteBlock.Video -> VideoBlockView(block, theme, callbacks)
    is NoteBlock.Table -> TableBlockView(block, theme, callbacks)
    NoteBlock.Rule -> Box(
      Modifier
        .fillMaxWidth()
        .height(1.dp)
        .background(Color(theme.border))
    )
  }
}

private fun textStyleFor(style: String, theme: NoteTheme): TextStyle {
  val body = TextStyle(
    color = Color(if (style == "quote") theme.tertiaryText else theme.text),
    fontSize = 16.sp,
    lineHeight = 24.sp,
    letterSpacing = (-0.032).sp
  )
  val headingSize = when (style) {
    "h1" -> 24
    "h2" -> 20
    "h3" -> 16
    "h4" -> 14
    "h5" -> 12
    "h6" -> 10
    else -> null
  }
  return when {
    headingSize != null -> body.copy(
      fontSize = headingSize.sp,
      lineHeight = maxOf(24, (headingSize * 1.25f).toInt()).sp,
      fontWeight = FontWeight.Bold
    )
    style == "bigEmoji" -> body.copy(fontSize = 36.sp, lineHeight = 44.sp)
    else -> body
  }
}

private fun annotated(
  runs: List<NoteRun>,
  theme: NoteTheme,
  callbacks: NotePreviewCallbacks
): AnnotatedString = buildAnnotatedString {
  for (run in runs) {
    val style = SpanStyle(
      color = run.color?.let(::Color)
        ?: when (run.tint) {
          "mention" -> Color(theme.mention)
          "tertiary" -> Color(theme.tertiaryText)
          else -> Color.Unspecified
        },
      background = when {
        run.tint == "mention" -> Color(theme.mentionBackground)
        run.code -> Color(theme.codeBackground)
        else -> Color.Unspecified
      },
      fontWeight = if (run.bold) FontWeight.Bold else null,
      fontStyle = if (run.italic) FontStyle.Italic else null,
      fontFamily = if (run.code) FontFamily.Monospace else null,
      textDecoration = if (run.strikethrough) TextDecoration.LineThrough else null
    )
    val link = when {
      run.link != null -> LinkAnnotation.Clickable(
        tag = "link",
        styles = TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline))
      ) { callbacks.onLink(run.link) }
      run.mention != null -> LinkAnnotation.Clickable(tag = "mention") {
        callbacks.onMention(run.mention)
      }
      else -> null
    }
    if (link != null) {
      withLink(link) { withStyle(style) { append(run.text) } }
    } else {
      withStyle(style) { append(run.text) }
    }
  }
}

@Composable
private fun TextBlockView(block: NoteBlock.Text, theme: NoteTheme, callbacks: NotePreviewCallbacks) {
  val text = remember(block, theme) { annotated(block.runs, theme, callbacks) }
  val style = textStyleFor(block.style, theme)
  when {
    block.style == "quote" -> Row(Modifier.height(IntrinsicSize.Min)) {
      Box(
        Modifier
          .width(2.dp)
          .fillMaxHeight()
          .background(Color(theme.border))
      )
      Spacer(Modifier.width(BlockEdge))
      BasicText(text, Modifier.weight(1f), style = style)
    }
    block.indent != null -> Row(Modifier.padding(start = IndentStep * block.indent)) {
      if (block.marker != null) {
        BasicText(block.marker, Modifier.width(MarkerWidth), style = style)
        Spacer(Modifier.width(MarkerGap))
      }
      BasicText(text, Modifier.weight(1f), style = style)
    }
    else -> BasicText(text, Modifier.fillMaxWidth(), style = style)
  }
}

@Composable
private fun CodeBlockView(block: NoteBlock.Code, theme: NoteTheme) {
  val context = LocalContext.current
  val text = remember(block, theme) {
    annotated(block.runs, theme, NotePreviewCallbacks({}, {}, {}, { _, _ -> }, {}))
  }
  var copied by remember { mutableStateOf(false) }
  LaunchedEffect(copied) {
    if (copied) {
      delay(2000)
      copied = false
    }
  }
  Column(
    Modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(Corner))
      .background(Color(theme.codeBackground))
  ) {
    DisableSelection {
      Row(
        Modifier
          .fillMaxWidth()
          .padding(start = BlockEdge, end = BlockEdge, top = 8.dp),
        horizontalArrangement = Arrangement.End
      ) {
        BasicText(
          if (copied) "Copied" else "Copy",
          Modifier.clickable {
            val clipboard =
              context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("code", text.text))
            copied = true
          },
          style = TextStyle(color = Color(theme.tertiaryText), fontSize = 12.sp)
        )
      }
    }
    Box(
      Modifier
        .horizontalScroll(rememberScrollState())
        .padding(start = BlockEdge, end = BlockEdge, bottom = BlockEdge)
    ) {
      BasicText(
        text,
        style = TextStyle(
          color = Color(theme.text),
          fontFamily = FontFamily.Monospace,
          fontSize = 14.sp,
          lineHeight = 24.sp
        ),
        softWrap = false
      )
    }
  }
}

private fun aspectOf(width: Float?, height: Float?): Float =
  if (width != null && height != null && width > 0 && height > 0) width / height else 4f / 3f

@Composable
private fun RemoteImage(
  src: String,
  aspect: Float,
  modifier: Modifier,
  onPress: (() -> Unit)? = null
) {
  val radius = with(LocalDensity.current) { Corner.toPx() }
  AndroidView(
    factory = { context ->
      ImageView(context).apply {
        scaleType = ImageView.ScaleType.CENTER_CROP
        clipToOutline = true
        outlineProvider = object : ViewOutlineProvider() {
          override fun getOutline(view: View, outline: Outline) {
            outline.setRoundRect(0, 0, view.width, view.height, radius)
          }
        }
      }
    },
    update = { view ->
      if (view.tag != src) {
        view.tag = src
        Glide.with(view).load(src).into(view)
      }
      // The ImageView takes its own clicks; a Compose clickable around an
      // AndroidView doesn't see them.
      view.setOnClickListener(onPress?.let { press -> View.OnClickListener { press() } })
      view.isClickable = onPress != null
    },
    modifier = modifier
      .fillMaxWidth()
      .aspectRatio(aspect)
  )
}

@Composable
private fun VideoBlockView(block: NoteBlock.Video, theme: NoteTheme, callbacks: NotePreviewCallbacks) {
  val aspect = aspectOf(block.width, block.height)
  Box(
    Modifier
      .fillMaxWidth()
      .aspectRatio(aspect)
      .clip(RoundedCornerShape(Corner))
      .background(Color(theme.codeBackground))
      .clickable { callbacks.onVideo(block.src, block.posterUri) },
    contentAlignment = Alignment.Center
  ) {
    if (block.posterUri != null) {
      RemoteImage(block.posterUri, aspect, Modifier)
    }
    DisableSelection {
      BasicText("▶", style = TextStyle(color = Color(theme.text), fontSize = 36.sp))
    }
  }
}

@Composable
private fun TableBlockView(block: NoteBlock.Table, theme: NoteTheme, callbacks: NotePreviewCallbacks) {
  val measurer = rememberTextMeasurer()
  val density = LocalDensity.current
  val columnCount = maxOf(block.header.size, block.rows.maxOfOrNull { it.size } ?: 0)
  val rows = listOf(block.header) + block.rows
  val bodyStyle = textStyleFor("body", theme)
  val headerStyle = bodyStyle.copy(fontWeight = FontWeight.Bold)
  val cellPadding = 8.dp
  val texts = remember(block, theme) {
    rows.map { row -> row.map { annotated(it, theme, callbacks) } }
  }
  val widths: List<Dp> = remember(texts, density) {
    (0 until columnCount).map { column ->
      val widest = texts.mapIndexed { r, row ->
        row.getOrNull(column)?.let {
          measurer.measure(it, if (r == 0) headerStyle else bodyStyle).size.width
        } ?: 0
      }.maxOrNull() ?: 0
      with(density) { widest.toDp() + cellPadding * 2 }.coerceIn(60.dp, 280.dp)
    }
  }
  Box(Modifier.horizontalScroll(rememberScrollState())) {
    Column(Modifier.border(1.dp, Color(theme.border))) {
      texts.forEachIndexed { r, row ->
        Row(Modifier.height(IntrinsicSize.Min)) {
          (0 until columnCount).forEach { column ->
            val align = when (block.align.getOrNull(column)) {
              "center" -> TextAlign.Center
              "right" -> TextAlign.End
              else -> TextAlign.Start
            }
            Box(
              Modifier
                .width(widths[column])
                .fillMaxHeight()
                .border(0.5.dp, Color(theme.border))
                .padding(cellPadding)
            ) {
              BasicText(
                row.getOrNull(column) ?: AnnotatedString(""),
                Modifier.fillMaxWidth(),
                style = (if (r == 0) headerStyle else bodyStyle).copy(textAlign = align)
              )
            }
          }
        }
      }
    }
  }
}
