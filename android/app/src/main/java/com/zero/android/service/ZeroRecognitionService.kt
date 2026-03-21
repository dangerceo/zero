package com.zero.android.service

import android.content.Intent
import android.speech.RecognitionService
import android.speech.RecognitionService.Callback

class ZeroRecognitionService : RecognitionService() {
    override fun onStartListening(intent: Intent, callback: Callback) {
        // No-op for now, we rely on manual trigger or system keyguard
    }

    override fun onStopListening(callback: Callback) {
        // No-op
    }

    override fun onCancel(callback: Callback) {
        // No-op
    }
}
