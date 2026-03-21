package com.zero.android.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import com.zero.android.ZeroApplication
import com.zero.android.data.remote.AgentsApi
import com.zero.android.data.remote.InterventionResponse
import com.zero.android.data.remote.TodoRequest
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
        const val EXTRA_INTERVENTION_ID = "extra_intervention_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val agentId = intent.getStringExtra(EXTRA_AGENT_ID) ?: return
        val interventionId = intent.getStringExtra(EXTRA_INTERVENTION_ID)
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
                if (interventionId != null) {
                    api.intervene(agentId, InterventionResponse(interventionId, replyText))
                } else {
                    api.addTodo(agentId, TodoRequest(replyText))
                }
                // Update notification state if needed
            } catch (_: Exception) {}
        }
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
}
