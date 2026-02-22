package com.zero.android.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import com.zero.android.ZeroApplication
import com.zero.android.data.remote.AgentsApi
import com.zero.android.data.remote.CommentRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class QuickReplyReceiver : BroadcastReceiver() {
    companion object {
        const val KEY_TEXT_REPLY = "key_text_reply"
        const val EXTRA_AGENT_ID = "extra_agent_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val agentId = intent.getStringExtra(EXTRA_AGENT_ID) ?: return
        val remoteInput = RemoteInput.getResultsFromIntent(intent)
        val replyText = remoteInput?.getCharSequence(KEY_TEXT_REPLY)?.toString() ?: return

        val app = context.applicationContext as ZeroApplication
        serviceScope.launch {
            val url = app.container.userPreferences.baseUrlFlow.firstOrNull() ?: return@launch
            
            val api = Retrofit.Builder()
                .baseUrl(url)
                .client(app.container.okHttpClient)
                .addConverterFactory(MoshiConverterFactory.create(app.container.moshi))
                .build()
                .create(AgentsApi::class.java)

            try {
                api.addComment(agentId, com.zero.android.data.remote.CommentRequest(replyText))
                // Optionally update notification to show "Sent" or just dismiss
            } catch (_: Exception) {}
        }
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
}
