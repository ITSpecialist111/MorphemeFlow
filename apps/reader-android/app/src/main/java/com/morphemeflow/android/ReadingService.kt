package com.morphemeflow.android

import android.accessibilityservice.AccessibilityButtonController
import android.accessibilityservice.AccessibilityService
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Choreographer
import android.view.ContextThemeWrapper
import android.view.Display
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowInsets
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.Toast
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.lang.ref.WeakReference
import kotlin.math.abs

class ReadingService : AccessibilityService() {
    private lateinit var manager: WindowManager
    private lateinit var uiContext: Context
    private lateinit var focus: FocusView
    private lateinit var toolbar: LinearLayout
    private lateinit var toolbarParams: WindowManager.LayoutParams
    private lateinit var readButton: ImageButton
    private lateinit var speech: OfflineSpeech
    private var preferences = ReaderPreferences()
    private var reader: ReaderView? = null
    private var readerPanel: LinearLayout? = null
    internal var capturedText = ""
        private set
    private val handler = Handler(Looper.getMainLooper())
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private var generation = 0L
    private var activeCapture: Long? = null
    private var screenVersion = 0L
    private var destroyed = false
    private var locked = false
    private var initialized = false
    private var receiverRegistered = false
    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) { checkLockState() }
    }
    private val accessibilityButton = object : AccessibilityButtonController.AccessibilityButtonCallback() {
        override fun onClicked(controller: AccessibilityButtonController) {
            if (preferences.toolsVisible) stopTools() else showTools()
        }
    }

    override fun onServiceConnected() {
        if (initialized) return
        instance = WeakReference(this)
        preferences = ReaderPreferences.load(this)
        manager = getSystemService(WindowManager::class.java)
        val display = getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY)
        uiContext = ContextThemeWrapper(createDisplayContext(display)
            .createWindowContext(WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, null), R.style.AppTheme)
        speech = OfflineSpeech(this, ::status)
        focus = FocusView(uiContext)
        focus.preferences = preferences
        toolbar = LinearLayout(uiContext).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(4), dp(4), dp(4), dp(4))
            setBackgroundColor(Color.WHITE)
        }
        val move = icon(android.R.drawable.ic_menu_sort_by_size, "Move reading band")
        var dragStart = 0f
        var centerStart = 0.45f
        move.setOnTouchListener { view, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> { dragStart = event.rawY; centerStart = preferences.bandCenter; true }
                MotionEvent.ACTION_MOVE -> {
                    val center = (centerStart + (event.rawY - dragStart) / focus.height.coerceAtLeast(1)).coerceIn(0f, 1f)
                    preferences = preferences.copy(bandCenter = center)
                    focus.preferences = preferences
                    generation++
                    dismissReader()
                    positionToolbar()
                    true
                }
                MotionEvent.ACTION_UP -> {
                    preferences.save(this)
                    if (abs(event.rawY - dragStart) < ViewConfiguration.get(uiContext).scaledTouchSlop) view.performClick()
                    true
                }
                MotionEvent.ACTION_CANCEL -> { preferences.save(this); true }
                else -> false
            }
        }
        move.setOnClickListener { openSettings() }
        toolbar.addView(move)
        readButton = icon(android.R.drawable.ic_menu_view, "Read screen band").apply { setOnClickListener { readBand() } }
        toolbar.addView(readButton)
        toolbar.addView(icon(android.R.drawable.ic_menu_crop, "Toggle screen focus").apply {
            setOnClickListener {
                preferences = preferences.copy(focusEnabled = !preferences.focusEnabled)
                preferences.save(this@ReadingService)
                focus.preferences = preferences
            }
        })
        toolbar.addView(icon(android.R.drawable.ic_menu_preferences, "Reading settings").apply { setOnClickListener { openSettings() } })
        toolbar.addView(icon(android.R.drawable.ic_menu_close_clear_cancel, "Turn off screen tools").apply { setOnClickListener { stopTools() } })
        val focusParams = params(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT).apply {
            flags = flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        }
        toolbarParams = params(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT).apply { x = dp(8) }
        manager.addView(focus, focusParams)
        manager.addView(toolbar, toolbarParams)
        initialized = true
        focus.onSurfaceChanged = {
            if (!destroyed) {
                generation++
                dismissReader()
                positionToolbar()
            }
        }
        val filter = IntentFilter().apply { addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_USER_PRESENT) }
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(unlockReceiver, filter, RECEIVER_NOT_EXPORTED)
        else registerReceiver(unlockReceiver, filter)
        receiverRegistered = true
        accessibilityButtonController.registerAccessibilityButtonCallback(accessibilityButton)
        checkLockState()
        restoreTools()
    }

    private fun params(width: Int, height: Int) = WindowManager.LayoutParams(
        width, height, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.TRANSLUCENT,
    ).apply {
        gravity = Gravity.TOP or Gravity.START
        setFitInsetsTypes(0)
        layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
    }

    private fun icon(resource: Int, label: String) = ImageButton(uiContext).apply {
        setImageResource(resource)
        imageTintList = ColorStateList.valueOf(Color.rgb(36, 36, 36))
        contentDescription = label
        tooltipText = label
        layoutParams = LinearLayout.LayoutParams(dp(48), dp(48))
    }

    private fun dp(value: Int): Int = (value * uiContext.resources.displayMetrics.density).toInt()

    private fun positionToolbar() {
        if (!initialized || focus.height == 0) return
        val insets = focus.rootWindowInsets?.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
        val top = (insets?.top ?: 0) + dp(8)
        val bottom = (focus.height - (insets?.bottom ?: 0) - dp(60)).coerceAtLeast(top)
        toolbarParams.y = (focus.band().top - dp(60)).coerceIn(top, bottom)
        manager.updateViewLayout(toolbar, toolbarParams)
    }

    fun refreshPreferences() {
        if (!initialized || destroyed) return
        preferences = ReaderPreferences.load(this)
        focus.preferences = preferences
        reader?.applyPreferences(preferences)
        positionToolbar()
        restoreTools()
    }

    fun showTools() {
        preferences = ReaderPreferences.load(this).copy(toolsVisible = true)
        preferences.save(this)
        refreshPreferences()
    }

    fun stopTools() {
        generation++
        preferences = preferences.copy(toolsVisible = false)
        preferences.save(this)
        speech.stop()
        dismissReader()
        restoreTools()
    }

    private fun restoreTools() {
        if (!initialized || destroyed) return
        val visible = preferences.toolsVisible && !locked && activeCapture == null
        focus.visibility = if (visible) View.VISIBLE else View.INVISIBLE
        toolbar.visibility = if (visible) View.VISIBLE else View.INVISIBLE
        readButton.isEnabled = activeCapture == null
    }

    private fun checkLockState() {
        if (!initialized) return
        val next = getSystemService(KeyguardManager::class.java).isKeyguardLocked
        if (next && !locked) {
            generation++
            speech.stop()
            dismissReader()
        }
        locked = next
        restoreTools()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && event.packageName?.toString() != packageName) screenVersion++
        checkLockState()
    }

    private fun readBand() {
        if (destroyed || locked || !preferences.toolsVisible || activeCapture != null || focus.width < 1 || focus.height < 1) return
        val request = ++generation
        activeCapture = request
        val sourceVersion = screenVersion
        val region = focus.band()
        val surfaceWidth = focus.width
        val surfaceHeight = focus.height
        dismissReader()
        restoreTools()
        handler.postDelayed({
            if (activeCapture == request) {
                generation++
                finishCapture(request)
                status("Screen capture timed out. Try again.")
            }
        }, 15_000)
        Choreographer.getInstance().postFrameCallback {
            Choreographer.getInstance().postFrameCallback captureFrame@{
                if (!isCurrent(request, sourceVersion)) { finishCapture(request); return@captureFrame }
                val callback = object : TakeScreenshotCallback {
                    override fun onSuccess(result: ScreenshotResult) {
                        var hardware: Bitmap? = null
                        val bitmap = try {
                            hardware = Bitmap.wrapHardwareBuffer(result.hardwareBuffer, result.colorSpace)
                            hardware?.copy(Bitmap.Config.ARGB_8888, false)
                        } catch (_: RuntimeException) { null }
                        finally { hardware?.recycle(); result.hardwareBuffer.close() }
                        if (bitmap == null) { finishCapture(request); status("Screen capture is unavailable."); return }
                        if (!isCurrent(request, sourceVersion)) { bitmap.recycle(); finishCapture(request); return }
                        val crop = CaptureGeometry.checkedCrop(region, surfaceWidth, surfaceHeight, bitmap.width, bitmap.height)
                        if (crop == null) {
                            Log.i("MorphemeFlow", "Capture dimensions: surface=${surfaceWidth}x$surfaceHeight bitmap=${bitmap.width}x${bitmap.height}")
                            bitmap.recycle()
                            finishCapture(request)
                            status("Screen size changed. Try reading the band again.")
                            return
                        }
                        val selected = Bitmap.createBitmap(bitmap, crop.left, crop.top, crop.width, crop.height)
                        if (selected !== bitmap) bitmap.recycle()
                        recognizer.process(InputImage.fromBitmap(selected, 0))
                            .addOnSuccessListener(mainExecutor) { resultText ->
                                if (isCurrent(request, sourceVersion)) {
                                    val text = resultText.text
                                    if (text.isBlank()) status("No text recognized. Move the band onto larger, clearer text.")
                                    else showReader(text, region)
                                }
                            }
                            .addOnFailureListener(mainExecutor) { if (isCurrent(request, sourceVersion)) status("Text recognition failed. Try again.") }
                            .addOnCompleteListener(mainExecutor) { selected.recycle(); finishCapture(request) }
                    }

                    override fun onFailure(errorCode: Int) {
                        if (isCurrent(request, sourceVersion)) status(when (errorCode) {
                            ERROR_TAKE_SCREENSHOT_SECURE_WINDOW -> "This app protects its screen. Use Share text when available."
                            ERROR_TAKE_SCREENSHOT_INTERVAL_TIME_SHORT -> "Screen capture was requested too quickly. Try again."
                            else -> "Android could not capture this screen. Use Share text when available."
                        })
                        finishCapture(request)
                    }
                }
                try {
                    takeScreenshot(Display.DEFAULT_DISPLAY, mainExecutor, callback)
                } catch (_: RuntimeException) {
                    finishCapture(request)
                    status("Screen capture access is unavailable. Check Android accessibility settings.")
                }
            }
        }
    }

    private fun isCurrent(request: Long, sourceVersion: Long): Boolean {
        val current = !destroyed && !locked && preferences.toolsVisible && generation == request && screenVersion == sourceVersion
        if (!current && !destroyed) Log.i("MorphemeFlow", "Capture discarded: request=$request generation=$generation source=$sourceVersion current=$screenVersion locked=$locked")
        return current
    }

    private fun finishCapture(request: Long) {
        if (activeCapture == request) {
            activeCapture = null
            restoreTools()
        }
    }

    private fun showReader(text: String, region: ScreenRegion) {
        dismissReader()
        val height = CaptureGeometry.lensHeight(region, focus.height, dp(300), dp(8))
        if (height < dp(120)) {
            status("Not enough room for the lens. Reduce the band height in Reading settings.")
            return
        }
        capturedText = text
        val content = ReaderView(uiContext)
        reader = content
        val panel = LinearLayout(uiContext).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
        }
        val actions = LinearLayout(uiContext)
        actions.addView(icon(android.R.drawable.ic_media_play, "Read aloud offline").apply { setOnClickListener { speech.speak(capturedText) } })
        actions.addView(icon(android.R.drawable.ic_media_pause, "Stop speech").apply { setOnClickListener { speech.stop() } })
        actions.addView(icon(android.R.drawable.ic_menu_close_clear_cancel, "Close reading lens").apply { setOnClickListener { dismissReader() } })
        panel.addView(actions)
        panel.addView(content, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        val layout = params((focus.width - dp(16)).coerceAtLeast(1), height).apply {
            x = dp(8)
            y = CaptureGeometry.lensTop(region, focus.height, height, dp(8))
        }
        manager.addView(panel, layout)
        readerPanel = panel
        content.showText(text, "Screen OCR snapshot")
    }

    private fun dismissReader() {
        capturedText = ""
        if (::speech.isInitialized) speech.stop()
        reader?.clear()
        readerPanel?.let { manager.removeView(it) }
        reader?.destroy()
        reader = null
        readerPanel = null
    }

    private fun openSettings() {
        generation++
        dismissReader()
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun status(message: String) {
        Log.i("MorphemeFlow", message)
        if (!destroyed) Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    override fun onInterrupt() {
        generation++
        dismissReader()
    }

    override fun onDestroy() {
        destroyed = true
        generation++
        handler.removeCallbacksAndMessages(null)
        dismissReader()
        if (initialized) {
            manager.removeView(toolbar)
            manager.removeView(focus)
            accessibilityButtonController.unregisterAccessibilityButtonCallback(accessibilityButton)
        }
        if (receiverRegistered) unregisterReceiver(unlockReceiver)
        if (::speech.isInitialized) speech.close()
        recognizer.close()
        instance = WeakReference(null)
        super.onDestroy()
    }

    companion object {
        private var instance = WeakReference<ReadingService>(null)
        val current: ReadingService? get() = instance.get()
    }
}