package com.morphemeflow.android

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.ByteArrayInputStream

@SuppressLint("SetJavaScriptEnabled")
class ReaderView(context: Context) : WebView(context) {
    private var ready = false
    private var pendingText = ""
    private var pendingSource = "Text"
    private var preferences = ReaderPreferences.load(context)

    init {
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context)).build()
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = false
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.blockNetworkLoads = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.textZoom = (resources.configuration.fontScale * 100).toInt()
        webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
                loader.shouldInterceptRequest(request.url)
                    ?: WebResourceResponse("text/plain", "UTF-8", ByteArrayInputStream(ByteArray(0)))

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true

            override fun onPageFinished(view: WebView, url: String) {
                if (url == READER_URL) {
                    ready = true
                    render()
                }
            }
        }
        loadUrl(READER_URL)
    }

    fun showText(text: String, source: String) {
        require(text.length <= 100_000)
        pendingText = text
        pendingSource = source
        render()
    }

    fun applyPreferences(value: ReaderPreferences) {
        preferences = value
        if (ready) evaluateJavascript("window.MorphemeFlow.preferences(${value.toJson()})", null)
    }

    private fun render() {
        if (ready) evaluateJavascript(
            "window.MorphemeFlow.receive(${JSONObject.quote(pendingText)},${JSONObject.quote(pendingSource)},${preferences.toJson()})",
            null,
        )
    }

    fun clear() {
        pendingText = ""
        pendingSource = "Text"
        render()
    }

    companion object {
        const val READER_URL = "https://appassets.androidplatform.net/assets/reader/reader.html"
    }
}