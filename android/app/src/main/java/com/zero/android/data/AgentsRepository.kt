package com.zero.android.data

import com.squareup.moshi.Moshi
import com.zero.android.data.model.Agent
import com.zero.android.data.model.AgentProgressEvent
import com.zero.android.data.model.AgentUiModel
import com.zero.android.data.model.ConnectionState
import com.zero.android.data.remote.AgentsApi
import com.zero.android.data.remote.CreateAgentRequest
import com.zero.android.data.remote.WebSocketEventParser
import com.zero.android.data.remote.WsEvent
import com.zero.android.util.baseUrlToWebSocketUrl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.atomic.AtomicInteger

class AgentsRepository(
    private val baseUrl: String,
    private val okHttpClient: OkHttpClient,
    private val moshi: Moshi,
    private val scope: CoroutineScope
) {
    private val api: AgentsApi = Retrofit.Builder()
        .baseUrl(baseUrl)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .client(okHttpClient)
        .build()
        .create(AgentsApi::class.java)

    private val _agents = MutableStateFlow<List<Agent>>(emptyList())
    private val _agyProjects = MutableStateFlow<List<com.zero.android.data.model.AgyProject>>(emptyList())
    private val _progress = MutableStateFlow<Map<String, AgentProgressEvent>>(emptyMap())
    private val _connection = MutableStateFlow(ConnectionState.Disconnected)

    val connection: StateFlow<ConnectionState> = _connection.asStateFlow()
    val agyProjects: StateFlow<List<com.zero.android.data.model.AgyProject>> = _agyProjects.asStateFlow()

    val agents: StateFlow<List<AgentUiModel>> = combine(_agents, _progress) { agents, progress ->
        agents.map { agent ->
            AgentUiModel.from(agent, progress[agent.id])
        }
    }.stateIn(scope, kotlinx.coroutines.flow.SharingStarted.Eagerly, emptyList())

    private var webSocket: WebSocket? = null
    private var reconnectJob: Job? = null
    private val reconnectAttempts = AtomicInteger(0)

    fun start() {
        refresh()
        connectWebSocket()
    }

    fun stop() {
        reconnectJob?.cancel()
        reconnectJob = null
        webSocket?.close(1000, "stopped")
        webSocket = null
        _connection.value = ConnectionState.Disconnected
    }

    fun refresh() {
        scope.launch {
            try {
                val agents = api.getAgents()
                _agents.value = agents.sortedByDescending { it.updatedAt ?: it.createdAt ?: "" }
                
                val agy = api.getAgyProjects()
                _agyProjects.value = agy
            } catch (_: Exception) {}
        }
    }

    suspend fun createAgent(goal: String, isMeta: Boolean = false): Agent? {
        return try {
            val workingDir = if (isMeta) "/Users/dalnk/Desktop/zero" else null
            val name = (if (isMeta) "\uD83D\uDD27 " else "") + goal.take(50)
            val agent = api.createAgent(CreateAgentRequest(goal = goal, name = name, workingDir = workingDir))
            upsertAgent(agent)
            api.startAgent(agent.id)
            agent
        } catch (_: Exception) {
            null
        }
    }

    suspend fun addTodo(agentId: String, todo: String) {
        try {
            val agent = api.addTodo(agentId, com.zero.android.data.remote.TodoRequest(todo))
            upsertAgent(agent)
        } catch (_: Exception) {}
    }

    suspend fun intervene(agentId: String, interventionId: String, response: String) {
        try {
            val agent = api.intervene(agentId, com.zero.android.data.remote.InterventionResponse(interventionId, response))
            upsertAgent(agent)
        } catch (_: Exception) {}
    }

    suspend fun getInterventions(): List<com.zero.android.data.model.Intervention> {
        return try {
            api.getInterventions()
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun connectWebSocket() {
        _connection.value = ConnectionState.Connecting
        val wsUrl = baseUrlToWebSocketUrl(baseUrl)
        val request = Request.Builder().url(wsUrl).build()
        webSocket?.close(1000, "reconnect")

        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                reconnectAttempts.set(0)
                _connection.value = ConnectionState.Connected
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val event = WebSocketEventParser.parse(text, moshi) ?: return
                when (event) {
                    is WsEvent.AgentUpdated -> upsertAgent(event.agent)
                    is WsEvent.AgentCreated -> upsertAgent(event.agent)
                    is WsEvent.AgentDeleted -> removeAgent(event.agentId)
                    is WsEvent.AgentProgressEvent -> updateProgress(event)
                    is WsEvent.AgentLogEvent -> appendLog(event.agentId, event.log)
                    is WsEvent.AgyProjects -> _agyProjects.value = event.projects
                    else -> Unit
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                _connection.value = ConnectionState.Disconnected
                scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _connection.value = ConnectionState.Disconnected
                scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        if (reconnectJob?.isActive == true) return
        reconnectJob = scope.launch {
            val attempt = reconnectAttempts.incrementAndGet()
            val delayMs = (2000L * attempt).coerceAtMost(30000L)
            delay(delayMs)
            connectWebSocket()
        }
    }

    private fun upsertAgent(agent: Agent) {
        val updated = _agents.value.toMutableList()
        val idx = updated.indexOfFirst { it.id == agent.id }
        if (idx >= 0) {
            updated[idx] = agent
        } else {
            updated.add(0, agent)
        }
        _agents.value = updated.sortedByDescending { it.updatedAt ?: it.createdAt ?: "" }
    }

    private fun updateProgress(event: WsEvent.AgentProgressEvent) {
        val map = _progress.value.toMutableMap()
        map[event.agentId] = AgentProgressEvent(
            step = event.step,
            stepCount = event.stepCount,
            actionType = event.actionType
        )
        _progress.value = map
    }

    private fun appendLog(agentId: String, log: com.zero.android.data.model.AgentLog) {
        var foundInAgents = false
        val updatedAgents = _agents.value.map { agent ->
            if (agent.id == agentId) {
                foundInAgents = true
                agent.copy(logs = agent.logs + log)
            } else {
                agent
            }
        }
        if (foundInAgents) {
            _agents.value = updatedAgents
        } else {
            val updatedAgy = _agyProjects.value.map { p ->
                if (p.id == agentId) {
                    p.copy(logs = p.logs + log)
                } else {
                    p
                }
            }
            _agyProjects.value = updatedAgy
        }
    }

    private fun removeAgent(agentId: String) {
        _agents.value = _agents.value.filterNot { it.id == agentId }
        val progressMap = _progress.value.toMutableMap()
        progressMap.remove(agentId)
        _progress.value = progressMap
    }
}
