package com.zero.android.data.remote

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.zero.android.data.model.Agent
import com.zero.android.data.model.AgentLog
import org.json.JSONObject

sealed class WsEvent {
    data class AgentCreated(val agent: Agent) : WsEvent()
    data class AgentUpdated(val agent: Agent) : WsEvent()
    data class AgentDeleted(val agentId: String) : WsEvent()
    data class AgentProgressEvent(
        val agentId: String,
        val step: String,
        val stepCount: Int,
        val actionType: String?
    ) : WsEvent()
    data class AgentLogEvent(val agentId: String, val log: AgentLog) : WsEvent()
    data class AgyProjects(val projects: List<com.zero.android.data.model.AgyProject>) : WsEvent()
}

object WebSocketEventParser {
    fun parse(text: String, moshi: Moshi): WsEvent? {
        return try {
            val json = JSONObject(text)
            val type = json.optString("type")
            when (type) {
                "agent:created" -> {
                    val agentJson = json.optJSONObject("agent") ?: return null
                    val adapter: JsonAdapter<Agent> = moshi.adapter(Agent::class.java)
                    val agent = adapter.fromJson(agentJson.toString()) ?: return null
                    WsEvent.AgentCreated(agent)
                }
                "agent:updated" -> {
                    val agentJson = json.optJSONObject("agent") ?: return null
                    val adapter: JsonAdapter<Agent> = moshi.adapter(Agent::class.java)
                    val agent = adapter.fromJson(agentJson.toString()) ?: return null
                    WsEvent.AgentUpdated(agent)
                }
                "agent:deleted" -> {
                    val agentId = json.optString("id")
                    if (agentId.isNullOrBlank()) null else WsEvent.AgentDeleted(agentId)
                }
                "agent:progress" -> {
                    val agentId = json.optString("agentId")
                    val step = json.optString("step")
                    val stepCount = json.optInt("stepCount", 0)
                    val actionType = json.optString("actionType", null)
                    WsEvent.AgentProgressEvent(agentId, step, stepCount, actionType)
                }
                "agent:log" -> {
                    val agentId = json.optString("agentId")
                    val logJson = json.optJSONObject("log") ?: return null
                    val adapter: JsonAdapter<AgentLog> = moshi.adapter(AgentLog::class.java)
                    val log = adapter.fromJson(logJson.toString()) ?: return null
                    WsEvent.AgentLogEvent(agentId, log)
                }
                "agy:projects" -> {
                    val projectsJson = json.optJSONArray("projects")?.toString() ?: return null
                    val adapter: JsonAdapter<List<com.zero.android.data.model.AgyProject>> = 
                        moshi.adapter(com.squareup.moshi.Types.newParameterizedType(List::class.java, com.zero.android.data.model.AgyProject::class.java))
                    adapter.fromJson(projectsJson)?.let { WsEvent.AgyProjects(it) }
                }
                else -> null
            }
        } catch (_: Exception) {
            null
        }
    }
}
