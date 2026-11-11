package io.tlon.notepreview

import org.json.JSONArray
import org.json.JSONObject

// Mirrors NoteDocumentBlock / NoteDocumentRun in
// packages/app/ui/components/NotesChannel/noteDocument.ts.

data class NoteRun(
  val text: String,
  val bold: Boolean = false,
  val italic: Boolean = false,
  val strikethrough: Boolean = false,
  val code: Boolean = false,
  val link: String? = null,
  val mention: String? = null,
  val color: Int? = null,
  val tint: String? = null
)

sealed class NoteBlock {
  data class Text(
    val style: String,
    val runs: List<NoteRun>,
    val indent: Int?,
    val marker: String?,
    val listStart: Boolean = false
  ) : NoteBlock()

  data class Code(val runs: List<NoteRun>) : NoteBlock()

  data class Image(
    val src: String,
    val width: Float,
    val height: Float,
    val alt: String
  ) : NoteBlock()

  data class Video(
    val src: String,
    val posterUri: String?,
    val width: Float?,
    val height: Float?
  ) : NoteBlock()

  data class Table(
    val header: List<List<NoteRun>>,
    val rows: List<List<List<NoteRun>>>,
    val align: List<String?>
  ) : NoteBlock()

  object Rule : NoteBlock()
}

data class NoteTheme(
  val text: Int = 0xFF1A1818.toInt(),
  val tertiaryText: Int = 0xFF999999.toInt(),
  val mention: Int = 0xFF008EFF.toInt(),
  val mentionBackground: Int = 0x1A008EFF,
  val codeBackground: Int = 0xFFF5F5F5.toInt(),
  val border: Int = 0xFFE5E5E5.toInt()
)

object NoteDocumentParser {
  fun parseBlocks(json: String): List<NoteBlock> {
    val array = JSONArray(json)
    return (0 until array.length()).mapNotNull { parseBlock(array.getJSONObject(it)) }
  }

  fun parseTheme(json: String): NoteTheme {
    val obj = JSONObject(json)
    val default = NoteTheme()
    fun color(key: String, fallback: Int) =
      if (obj.isNull(key)) fallback else obj.optLong(key, fallback.toLong()).toInt()
    return NoteTheme(
      text = color("text", default.text),
      tertiaryText = color("tertiaryText", default.tertiaryText),
      mention = color("mention", default.mention),
      mentionBackground = color("mentionBackground", default.mentionBackground),
      codeBackground = color("codeBackground", default.codeBackground),
      border = color("border", default.border)
    )
  }

  private fun parseBlock(obj: JSONObject): NoteBlock? =
    when (obj.optString("type")) {
      "text" -> NoteBlock.Text(
        style = obj.optString("style", "body"),
        runs = parseRuns(obj.optJSONArray("runs")),
        indent = if (obj.has("indent") && !obj.isNull("indent")) obj.getInt("indent") else null,
        marker = obj.optStringOrNull("marker"),
        listStart = obj.optBoolean("listStart", false)
      )
      "code" -> NoteBlock.Code(parseRuns(obj.optJSONArray("runs")))
      "image" -> NoteBlock.Image(
        src = obj.optString("src"),
        width = obj.optDouble("width", 0.0).toFloat(),
        height = obj.optDouble("height", 0.0).toFloat(),
        alt = obj.optString("alt", "")
      )
      "video" -> NoteBlock.Video(
        src = obj.optString("src"),
        posterUri = obj.optStringOrNull("posterUri"),
        width = obj.optDoubleOrNull("width")?.toFloat(),
        height = obj.optDoubleOrNull("height")?.toFloat()
      )
      "table" -> {
        val header = obj.optJSONArray("header") ?: JSONArray()
        val rows = obj.optJSONArray("rows") ?: JSONArray()
        val align = obj.optJSONArray("align") ?: JSONArray()
        NoteBlock.Table(
          header = (0 until header.length()).map { parseRuns(header.optJSONArray(it)) },
          rows = (0 until rows.length()).map { r ->
            val row = rows.getJSONArray(r)
            (0 until row.length()).map { parseRuns(row.optJSONArray(it)) }
          },
          align = (0 until align.length()).map { align.optStringOrNull(it) }
        )
      }
      "rule" -> NoteBlock.Rule
      else -> null
    }

  private fun parseRuns(array: JSONArray?): List<NoteRun> {
    if (array == null) return emptyList()
    return (0 until array.length()).map { i ->
      val run = array.getJSONObject(i)
      NoteRun(
        text = run.optString("text"),
        bold = run.optBoolean("bold"),
        italic = run.optBoolean("italic"),
        strikethrough = run.optBoolean("strikethrough"),
        code = run.optBoolean("code"),
        link = run.optStringOrNull("link"),
        mention = run.optStringOrNull("mention"),
        color = run.optStringOrNull("color")?.let(::parseCssColor),
        tint = run.optStringOrNull("tint")
      )
    }
  }

  // Code highlighting colours are CSS hex strings, including the #rgb form.
  private fun parseCssColor(value: String): Int? {
    if (!value.startsWith("#")) return null
    val hex = value.substring(1)
    val expanded = when (hex.length) {
      3 -> hex.map { "$it$it" }.joinToString("")
      6 -> hex
      else -> return null
    }
    return expanded.toLongOrNull(16)?.let { (0xFF000000 or it).toInt() }
  }
}

private fun JSONObject.optStringOrNull(key: String): String? =
  if (has(key) && !isNull(key)) getString(key) else null

private fun JSONObject.optDoubleOrNull(key: String): Double? =
  if (has(key) && !isNull(key)) getDouble(key) else null

private fun JSONArray.optStringOrNull(index: Int): String? =
  if (isNull(index)) null else optString(index)
