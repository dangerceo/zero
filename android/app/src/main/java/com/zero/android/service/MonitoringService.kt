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
import com.zero.android.data.model.AgentLog
import com.zero.android.data.model.AgentProgressEvent
import com.zero.android.data.model.AgentUiModel
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

    private val notificationManager by lazy {
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    }

    private val okHttpClient: OkHttpClient by lazy {
        (application as ZeroApplication).container.okHttpClient
    }

    private val moshi: Moshi by lazy {
        (application as ZeroApplication).container.moshi
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startMonitoring()
            ACTION_STOP -> stopMonitoring()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        stopMonitoring()
        serviceScope.cancel()
    }

    private fun startMonitoring() {
        startForeground(SERVICE_ID, NotificationHelper.buildServiceNotification(this, 0))

        serviceScope.launch {
            val baseUrl = (application as ZeroApplication)
                .container
                .userPreferences
                .baseUrlFlow
                .firstOrNull()

            if (baseUrl.isNullOrBlank()) {
                stopSelf()
                return@launch
            }

            val api = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(okHttpClient)
                .addConverterFactory(MoshiConverterFactory.create(moshi))
                .build()
                .create(AgentsApi::class.java)

            try {
                val list = api.getAgents()
                list.forEach { agents[it.id] = it }
                updateNotifications()
            } catch (_: Exception) {
                // Ignore initial fetch failures.
            }

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
        val wsUrl = baseUrlToWebSocketUrl(baseUrl)
        val request = Request.Builder().url(wsUrl).build()
        webSocket?.close(1000, "restart")

        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                when (val event = WebSocketEventParser.parse(text, moshi)) {
                    is WsEvent.AgentCreated -> {
                        agents[event.agent.id] = event.agent
                        updateNotifications()
                    }
                    is WsEvent.AgentUpdated -> {
                        agents[event.agent.id] = event.agent
                        updateNotifications()
                    }
                    is WsEvent.AgentLogEvent -> {
                        val agent = agents[event.agentId]
                        if (agent != null) {
                            agents[event.agentId] = agent.copy(logs = agent.logs + event.log)
                        }
                    }
                    is WsEvent.AgentProgressEvent -> {
                        progress[event.agentId] = AgentProgressEvent(
                            step = event.step,
                            stepCount = event.stepCount,
                            actionType = event.actionType
                        )
                        updateNotifications()
                    }
                    is WsEvent.AgentDeleted -> {
                        agents.remove(event.agentId)
                        progress.remove(event.agentId)
                        notificationManager.cancel(event.agentId.hashCode().absoluteValue)
                        updateNotifications()
                    }
                    null -> Unit
                    else -> Unit
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                updateNotifications()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                updateNotifications()
            }
        })
    }

    private fun updateNotifications() {
        val activeCount = agents.values.count { it.status == "running" || it.status == "waiting" }
        val serviceNotification = NotificationHelper.buildServiceNotification(this, activeCount)
        notificationManager.notify(SERVICE_ID, serviceNotification)

        agents.values.forEach { agent ->
            val progressInfo = progress[agent.id]
            val ongoing = agent.status == "running" || agent.status == "waiting"
            val progressValue = progressInfo?.stepCount?.let { it * 10 }?.coerceAtMost(100) ?: 0
            
            val pendingIntent = PendingIntent.getActivity(
                this,
                agent.id.hashCode().absoluteValue,
                Intent(this, MainActivity::class.java).apply {
                    putExtra("extra_agent_id", agent.id)
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationHelper.buildAgentNotification(
                context = this,
                agentId = agent.id,
                agentName = agent.name,
                status = agent.status,
                currentStep = progressInfo?.step,
                progress = progressValue,
                ongoing = ongoing,
                pendingIntent = pendingIntent
            )
            notificationManager.notify(agent.id.hashCode().absoluteValue, notification)
        }

        if (agents.isNotEmpty()) {
            val summary = NotificationHelper.buildSummaryNotification(this, agents.size)
            notificationManager.notify(SUMMARY_ID, summary)
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
