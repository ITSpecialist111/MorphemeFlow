package com.morphemeflow.android

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.view.WindowInsets
import android.widget.*

class MainActivity : Activity() {
    private lateinit var reader: ReaderView
    private lateinit var speech: OfflineSpeech
    private lateinit var status: TextView
    private lateinit var input: EditText
    private lateinit var inputPanel: LinearLayout
    private lateinit var preferencesPanel: ScrollView
    private var preferences = ReaderPreferences()
    private var text = ""
    private var textSource = "Text"

    private data class Passage(val text: String, val source: String)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        preferences = ReaderPreferences.load(this)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.setOnApplyWindowInsetsListener { view, insets ->
            val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            view.setPadding(dp(12) + bars.left, bars.top, dp(12) + bars.right, bars.bottom)
            insets
        }
        val header = LinearLayout(this).apply { gravity = android.view.Gravity.CENTER_VERTICAL }
        header.addView(TextView(this).apply { text = "MorphemeFlow"; textSize = 22f }, LinearLayout.LayoutParams(0, dp(56), 1f))
        header.addView(icon(android.R.drawable.ic_menu_preferences, "Reading settings") {
            preferencesPanel.visibility = if (preferencesPanel.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        })
        header.addView(icon(android.R.drawable.ic_menu_add, "Read new text") { clearText() })
        root.addView(header)
        root.addView(Button(this).apply { text = "Screen tools"; setOnClickListener { openScreenTools() } })
        status = TextView(this).apply { textSize = 14f; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
        root.addView(status)
        preferencesPanel = buildPreferences().apply { visibility = View.GONE }
        root.addView(preferencesPanel, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(230)))
        input = EditText(this).apply {
            hint = "Text to read"
            contentDescription = "Text to read"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            minLines = 2
            maxLines = 5
        }
        inputPanel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        inputPanel.addView(input)
        inputPanel.addView(Button(this).apply { text = "Read text"; setOnClickListener { showText(input.text.toString(), "Entered text") } })
        root.addView(inputPanel)
        reader = ReaderView(this)
        root.addView(reader, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        speech = OfflineSpeech(this) { status.text = it }
        val actions = LinearLayout(this)
        actions.addView(icon(android.R.drawable.ic_media_play, "Read aloud offline") { speech.speak(text) })
        actions.addView(icon(android.R.drawable.ic_media_pause, "Stop speech") { speech.stop() })
        actions.addView(icon(android.R.drawable.ic_menu_close_clear_cancel, "Clear text") { clearText() })
        root.addView(actions)
        setContentView(root)
        val passage = lastNonConfigurationInstance as? Passage
        if (passage == null) receiveIntent(intent) else showText(passage.text, passage.source)
    }

    override fun onResume() {
        super.onResume()
        status.text = if (ReadingService.current == null) "Screen tools not enabled" else "Screen tools available"
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        receiveIntent(intent)
    }

    private fun receiveIntent(intent: Intent) {
        val shared = when (intent.action) {
            Intent.ACTION_SEND -> intent.getCharSequenceExtra(Intent.EXTRA_TEXT)
            Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)
            else -> null
        }
        intent.removeExtra(Intent.EXTRA_TEXT)
        intent.removeExtra(Intent.EXTRA_PROCESS_TEXT)
        if (shared != null) showText(shared.toString(), "Shared text")
    }

    private fun showText(source: String, label: String) {
        if (source.length > 100_000) { status.text = "Select a shorter passage (up to 100,000 characters)."; return }
        if (source.isBlank()) { status.text = "Enter or share some text first."; return }
        speech.stop()
        text = source
        textSource = label
        reader.showText(source, label)
        inputPanel.visibility = View.GONE
        input.text.clear()
        (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
            .hideSoftInputFromWindow(input.windowToken, 0)
        status.text = label
    }

    private fun clearText() {
        speech.stop()
        text = ""
        reader.clear()
        input.text.clear()
        inputPanel.visibility = View.VISIBLE
        status.text = "Text cleared"
    }

    private fun openScreenTools() {
        val service = ReadingService.current
        if (service != null) {
            service.showTools()
            moveTaskToBack(true)
            return
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.accessibility_consent_title)
            .setMessage(R.string.accessibility_consent)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton("Open accessibility settings") { _, _ -> startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
            .show()
    }

    private fun buildPreferences(): ScrollView {
        val fields = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        fun toggle(label: String, checked: Boolean, update: (Boolean) -> ReaderPreferences) {
            fields.addView(CheckBox(this).apply {
                text = label; isChecked = checked
                setOnCheckedChangeListener { _, value -> save(update(value)) }
            })
        }
        fun slider(label: String, min: Int, max: Int, value: Int, update: (Int) -> ReaderPreferences) {
            val caption = TextView(this).apply { text = "$label: $value" }
            fields.addView(caption)
            fields.addView(SeekBar(this).apply {
                this.min = min; this.max = max; progress = value; contentDescription = label
                setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(bar: SeekBar, progress: Int, fromUser: Boolean) {
                        if (fromUser) { caption.text = "$label: $progress"; save(update(progress)) }
                    }
                    override fun onStartTrackingTouch(bar: SeekBar) {}
                    override fun onStopTrackingTouch(bar: SeekBar) {}
                })
            })
        }
        fun picker(label: String, choices: List<String>, selected: String, update: (String) -> ReaderPreferences) {
            fields.addView(TextView(this).apply { text = label })
            fields.addView(Spinner(this).apply {
                contentDescription = label
                adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, choices)
                setSelection(choices.indexOf(selected).coerceAtLeast(0))
                onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                    override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) { save(update(choices[position])) }
                    override fun onNothingSelected(parent: AdapterView<*>?) {}
                }
            })
        }
        toggle("Morpheme colours", preferences.morphemesEnabled) { preferences.copy(morphemesEnabled = it) }
        toggle("Syllable spacing", preferences.syllablesEnabled) { preferences.copy(syllablesEnabled = it) }
        toggle("Screen focus", preferences.focusEnabled) { preferences.copy(focusEnabled = it) }
        picker("Font", listOf("lexend", "atkinson", "opendyslexic", "system"), preferences.font) { preferences.copy(font = it) }
        slider("Text size", 14, 36, preferences.fontSize) { preferences.copy(fontSize = it) }
        slider("Band height", 40, 320, preferences.bandHeight) { preferences.copy(bandHeight = it) }
        slider("Band position", 0, 100, (preferences.bandCenter * 100).toInt()) { preferences.copy(bandCenter = it / 100f) }
        slider("Surround dimming", 0, 70, preferences.dimOpacity) { preferences.copy(dimOpacity = it) }
        slider("Band tint", 0, 30, preferences.tintOpacity) { preferences.copy(tintOpacity = it) }
        picker("Tint colour", listOf("warm", "rose", "mint", "sky"), preferences.tint) { preferences.copy(tint = it) }
        fields.addView(Button(this).apply { text = "Turn off screen tools"; setOnClickListener { ReadingService.current?.stopTools() } })
        return ScrollView(this).apply { addView(fields) }
    }

    private fun save(value: ReaderPreferences) {
        preferences = value
        value.save(this)
        if (::reader.isInitialized) reader.applyPreferences(value)
        ReadingService.current?.refreshPreferences()
    }

    private fun icon(resource: Int, label: String, action: () -> Unit) = ImageButton(this).apply {
        setImageResource(resource); contentDescription = label; tooltipText = label
        imageTintList = ColorStateList.valueOf(Color.rgb(36, 36, 36))
        layoutParams = LinearLayout.LayoutParams(dp(48), dp(48))
        setOnClickListener { action() }
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onRetainNonConfigurationInstance(): Any? =
        text.takeIf { it.isNotEmpty() }?.let { Passage(it, textSource) }

    override fun onDestroy() {
        speech.close()
        reader.clear()
        reader.destroy()
        super.onDestroy()
    }
}