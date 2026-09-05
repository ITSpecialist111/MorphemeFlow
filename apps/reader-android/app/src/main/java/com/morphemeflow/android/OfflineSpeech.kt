package com.morphemeflow.android

import android.content.Context
import android.speech.tts.TextToSpeech

class OfflineSpeech(context: Context, private val status: (String) -> Unit) {
    private var ready = false
    private val speech = TextToSpeech(context) { result -> ready = result == TextToSpeech.SUCCESS }

    fun speak(text: String) {
        if (!ready) { status("Speech is not ready. Try again."); return }
        val voice = speech.voices?.firstOrNull { !it.isNetworkConnectionRequired && it.locale.language == "en" }
        if (voice == null) { status("Install an offline English voice in Android speech settings."); return }
        if (speech.setVoice(voice) != TextToSpeech.SUCCESS) { status("The offline voice is unavailable."); return }
        speech.setSpeechRate(0.9f)
        speech.stop()
        var offset = 0
        val limit = TextToSpeech.getMaxSpeechInputLength() - 1
        while (offset < text.length) {
            var end = (offset + limit).coerceAtMost(text.length)
            if (end < text.length && Character.isHighSurrogate(text[end - 1])) end--
            val result = speech.speak(text.substring(offset, end), TextToSpeech.QUEUE_ADD, null, "reading-$offset")
            if (result == TextToSpeech.ERROR) { status("The offline voice could not read this text."); return }
            offset = end
        }
    }

    fun stop() { speech.stop() }
    fun close() { speech.stop(); speech.shutdown() }
}