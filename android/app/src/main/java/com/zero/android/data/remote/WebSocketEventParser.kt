package com.zero.android.data.remote

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.zero.android.data.model.Agent
import com.zero.android.data.model.AgentLog

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
            val mapAdapter = moshi.adapter<Map<String, Any>>(
                Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java)
            )
            val jsonMap = mapAdapter.fromJson(text) ?: return null
            val type = jsonMap["type"] as? String ?: return null
            
            when (type) {
                "agent:created" -> {
                    val agentMap = jsonMap["agent"] as? Map<*, *> ?: return null
                    val adapter = moshi.adapter(Agent::class.java)
                    adapter.fromJsonValue(agentMap)?.let { WsEvent.AgentCreated(it) }
                }
                "agent:updated" -> {
                    val agentMap = jsonMap["agent"] as? Map<*, *> ?: return null
                    val adapter = moshi.adapter(Agent::class.java)
                    adapter.fromJsonValue(agentMap)?.let { WsEvent.AgentUpdated(it) }
                }
                "agent:deleted" -> {
                    val agentId = jsonMap["id"] as? String
                    if (agentId.isNullOrBlank()) null else WsEvent.AgentDeleted(agentId)
                }
                "agent:progress" -> {
                    val agentId = (jsonMap["agentId"] as? String) ?: ""
                    val step = (jsonMap["step"] as? String) ?: ""
                    val stepCount = (jsonMap["stepCount"] as? Double)?.toInt() ?: 0
                    val actionType = jsonMap["actionType"] as? String
                    WsEvent.AgentProgressEvent(agentId, step, stepCount, actionType)
                }
                "agent:log" -> {
                    val agentId = jsonMap["agentId"] as? String ?: return null
                    val logMap = jsonMap["log"] as? Map<*, *> ?: return null
                    val adapter = moshi.adapter(AgentLog::class.java)
                    adapter.fromJsonValue(logMap)?.let { WsEvent.AgentLogEvent(agentId, it) }
                }
                "agy:projects" -> {
                    val projectsList = jsonMap["projects"] as? List<*> ?: return null
                    val adapter: JsonAdapter<List<com.zero.android.data.model.AgyProject>> = 
                        moshi.adapter(Types.newParameterizedType(List::class.java, com.zero.android.data.model.AgyProject::class.java))
                    adapter.fromJsonValue(projectsList)?.let { WsEvent.AgyProjects(it) }
                }
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }
}
