package com.zero.android.service

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import com.zero.android.ui.AssistantActivity

class ZeroVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        
        // Launch our UI activity
        val intent = Intent(context, AssistantActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startVoiceActivity(intent)
    }

    override fun onHide() {
        super.onHide()
        // Signal the activity to finish if needed
    }
}
