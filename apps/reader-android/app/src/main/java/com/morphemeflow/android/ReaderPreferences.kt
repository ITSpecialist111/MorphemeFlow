package com.morphemeflow.android

import android.content.Context
import android.graphics.Color
import org.json.JSONObject

data class ReaderPreferences(
    val font: String = "lexend",
    val fontSize: Int = 20,
    val morphemesEnabled: Boolean = true,
    val syllablesEnabled: Boolean = true,
    val bandHeight: Int = 100,
    val dimOpacity: Int = 35,
    val tintOpacity: Int = 0,
    val tint: String = "warm",
    val bandCenter: Float = 0.45f,
    val focusEnabled: Boolean = true,
    val toolsVisible: Boolean = true,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("font", font).put("fontSize", fontSize)
        .put("morphemesEnabled", morphemesEnabled).put("syllablesEnabled", syllablesEnabled)

    fun tintColor(): Int = when (tint) {
        "rose" -> Color.rgb(255, 182, 200)
        "mint" -> Color.rgb(174, 235, 193)
        "sky" -> Color.rgb(174, 214, 255)
        else -> Color.rgb(255, 225, 150)
    }

    fun save(context: Context) {
        context.getSharedPreferences("reading-preferences", Context.MODE_PRIVATE).edit()
            .putString("font", font).putInt("fontSize", fontSize.coerceIn(14, 36))
            .putBoolean("morphemesEnabled", morphemesEnabled).putBoolean("syllablesEnabled", syllablesEnabled)
            .putInt("bandHeight", bandHeight.coerceIn(40, 320)).putInt("dimOpacity", dimOpacity.coerceIn(0, 70))
            .putInt("tintOpacity", tintOpacity.coerceIn(0, 30)).putString("tint", tint)
            .putFloat("bandCenter", bandCenter.coerceIn(0f, 1f)).putBoolean("focusEnabled", focusEnabled)
            .putBoolean("toolsVisible", toolsVisible).apply()
    }

    companion object {
        fun load(context: Context): ReaderPreferences {
            val stored = context.getSharedPreferences("reading-preferences", Context.MODE_PRIVATE)
            return ReaderPreferences(
                font = stored.getString("font", "lexend") ?: "lexend",
                fontSize = stored.getInt("fontSize", 20).coerceIn(14, 36),
                morphemesEnabled = stored.getBoolean("morphemesEnabled", true),
                syllablesEnabled = stored.getBoolean("syllablesEnabled", true),
                bandHeight = stored.getInt("bandHeight", 100).coerceIn(40, 320),
                dimOpacity = stored.getInt("dimOpacity", 35).coerceIn(0, 70),
                tintOpacity = stored.getInt("tintOpacity", 0).coerceIn(0, 30),
                tint = stored.getString("tint", "warm") ?: "warm",
                bandCenter = stored.getFloat("bandCenter", 0.45f).takeIf { it.isFinite() }?.coerceIn(0f, 1f) ?: 0.45f,
                focusEnabled = stored.getBoolean("focusEnabled", true),
                toolsVisible = stored.getBoolean("toolsVisible", true),
            )
        }
    }
}