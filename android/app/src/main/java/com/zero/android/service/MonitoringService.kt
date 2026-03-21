package com.zero.android.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import com.squareup.moshi.Moshi
import com.zero.android.MainActivity
import com.zero.android.R
import com.zero.android.ZeroApplication
import com.zero.android.data.model.Agent
import com.zero.android.data.model.AgentProgressEvent
import com.zero.android.data.remote.AgentsApi
import com.zero.android.data.remote.WebSocketEventParser
import com.zero.android.data.remote.WsEvent
import com.zero.android.util.baseUrlToWebSocketUrl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import kotlin.math.absoluteValue

class MonitoringService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var webSocket: WebSocket? = null
    private val agents = mutableMapOf<String, Agent>()
    private val progress = mutableMapOf<String, AgentProgressEvent>()
    private val notificationManager by lazy { getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager }
    private val okHttpClient: OkHttpClient by lazy { (application as ZeroApplication).container.okHttpClient }
    private val moshi: Moshi by lazy { (application as ZeroApplication).container.moshi }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onCreate() { super.onCreate(); NotificationHelper.ensureChannels(this) }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startMonitoring()
            ACTION_STOP -> stopMonitoring()
        }
        return START_STICKY
    }
    override fun onDestroy() { super.onDestroy(); stopMonitoring(); serviceScope.cancel() }

    private fun startMonitoring() {
        startForeground(SERVICE_ID, NotificationHelper.buildServiceNotification(this, 0))
        serviceScope.launch {
            val baseUrl = (application as ZeroApplication).container.userPreferences.baseUrlFlow.firstOrNull()
            if (baseUrl.isNullOrBlank()) { stopSelf(); return@launch }
            val api = Retrofit.Builder().baseUrl(baseUrl).client(okHttpClient).addConverterFactory(MoshiConverterFactory.create(moshi)).build().create(AgentsApi::class.java)
            try {
                val list = api.getAgents()
                list.forEach { agents[it.id] = it }
                updateNotifications()
            } catch (_: Exception) { }
            connectWebSocket(baseUrl)
        }
    }

    private fun stopMonitoring() {
        webSocket?.close(1000, "stopped")
        webSocket = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun connectWebSocket(baseUrl: String) {
        val request = Request.Builder().url(baseUrlToWebSocketUrl(baseUrl)).build()
        webSocket?.close(1000, "restart")
        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                when (val event = WebSocketEventParser.parse(text, moshi)) {
                    is WsEvent.AgentCreated -> { agents[event.agent.id] = event.agent; updateNotifications() }
                    is WsEvent.AgentUpdated -> { agents[event.agent.id] = event.agent; updateNotifications() }
                    is WsEvent.AgentProgressEvent -> {
                        progress[event.agentId] = AgentProgressEvent(step = event.step, stepCount = event.stepCount, actionType = event.actionType)
                        updateNotifications()
                    }
                    is WsEvent.AgentDeleted -> {
                        agents.remove(event.agentId); progress.remove(event.agentId)
                        notificationManager.cancel(event.agentId.hashCode().absoluteValue)
                        updateNotifications()
                    }
                    else -> Unit
                }
            }
        })
    }

    private fun updateNotifications() {
        val activeAgents = agents.values.filter { it.status == "running" || it.status == "waiting" || it.status == "planning" }
        notificationManager.notify(SERVICE_ID, NotificationHelper.buildServiceNotification(this, activeAgents.size))

        // Clear notifications for agents that are no longer active
        val allAgentIds = agents.keys
        val activeAgentIds = activeAgents.map { it.id }.toSet()
        allAgentIds.subtract(activeAgentIds).forEach { id ->
            notificationManager.cancel(id.hashCode().absoluteValue)
        }

        activeAgents.forEach { agent ->
            val progressInfo = progress[agent.id]
            val pendingIntent = PendingIntent.getActivity(
                this,
                agent.id.hashCode().absoluteValue,
                Intent(this, MainActivity::class.java).apply {
                    putExtra("extra_agent_id", agent.id)
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val unresolvedIntervention = agent.interventions?.find { !it.resolved }
            if (agent.status == "waiting" && unresolvedIntervention != null) {
                val notification = NotificationHelper.buildInterventionNotification(
                    this,
                    agent.id,
                    agent.name,
                    unresolvedIntervention.id,
                    unresolvedIntervention.message,
                    unresolvedIntervention.type,
                    unresolvedIntervention.options.map { it.label to it.value },
                    pendingIntent
                )
                notificationManager.notify(agent.id.hashCode().absoluteValue, notification)
            } else {
                val notification = NotificationHelper.buildAgentNotification(
                    this,
                    agent.id,
                    agent.name,
                    agent.status,
                    progressInfo?.step,
                    progressInfo?.stepCount?.let { it * 10 }?.coerceAtMost(100) ?: 0,
                    true,
                    pendingIntent
                )
                notificationManager.notify(agent.id.hashCode().absoluteValue, notification)
            }
        }

        if (activeAgents.isNotEmpty()) {
            notificationManager.notify(SUMMARY_ID, NotificationHelper.buildSummaryNotification(this, activeAgents.size))
        } else {
            notificationManager.cancel(SUMMARY_ID)
        }
    }

    companion object {
        const val ACTION_START = "com.zero.android.action.START_MONITORING"
        const val ACTION_STOP = "com.zero.android.action.STOP_MONITORING"
        private const val SERVICE_ID = 7001
        private const val SUMMARY_ID = 7002
    }
}
