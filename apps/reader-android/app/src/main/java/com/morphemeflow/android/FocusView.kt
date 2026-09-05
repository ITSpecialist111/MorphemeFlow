package com.morphemeflow.android

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.View

class FocusView(context: Context) : View(context) {
    var preferences = ReaderPreferences.load(context)
        set(value) { field = value; invalidate() }
    var onSurfaceChanged: () -> Unit = {}
    private val paint = Paint()

    init { importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS }

    fun band(): ScreenRegion = CaptureGeometry.band(
        width.coerceAtLeast(1), height.coerceAtLeast(1), preferences.bandCenter,
        preferences.bandHeight, resources.displayMetrics.density,
    )

    override fun onDraw(canvas: Canvas) {
        if (!preferences.focusEnabled) return
        val band = band()
        paint.color = Color.BLACK
        paint.alpha = preferences.dimOpacity * 255 / 100
        canvas.drawRect(0f, 0f, width.toFloat(), band.top.toFloat(), paint)
        canvas.drawRect(0f, band.bottom.toFloat(), width.toFloat(), height.toFloat(), paint)
        paint.color = preferences.tintColor()
        paint.alpha = preferences.tintOpacity * 255 / 100
        canvas.drawRect(0f, band.top.toFloat(), width.toFloat(), band.bottom.toFloat(), paint)
    }

    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        super.onSizeChanged(width, height, oldWidth, oldHeight)
        post { onSurfaceChanged() }
    }
}