package com.zero.android.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.zero.android.ZeroApplication
import com.zero.android.data.remote.AgentsApi
import com.zero.android.data.remote.InterventionResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class QuickActionReceiver : BroadcastReceiver() {
    companion object {
        const val EXTRA_AGENT_ID = "extra_agent_id"
        const val EXTRA_INTERVENTION_ID = "extra_intervention_id"
        const val EXTRA_RESPONSE_VALUE = "extra_response_value"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val agentId = intent.getStringExtra(EXTRA_AGENT_ID) ?: return
        val interventionId = intent.getStringExtra(EXTRA_INTERVENTION_ID) ?: return
        val response = intent.getStringExtra(EXTRA_RESPONSE_VALUE) ?: return

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
                api.intervene(agentId, InterventionResponse(interventionId, response))
                // Dismiss or update notification
            } catch (_: Exception) {}
        }
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
}
