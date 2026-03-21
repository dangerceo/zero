package com.zero.android.data.model

data class AgentUiModel(
    val id: String,
    val name: String,
    val status: String,
    val lastUpdated: String? = null,
    val progress: Int = 0,
    val currentStep: String? = null,
    val lastLog: String? = null,
    val logs: List<AgentLog> = emptyList(),
    val threads: List<ThreadEntry> = emptyList()
) {
    companion object {
        fun from(agent: Agent, progressEvent: AgentProgressEvent? = null): AgentUiModel {
            return AgentUiModel(
                id = agent.id,
                name = agent.name,
                status = agent.status,
                lastUpdated = agent.updatedAt,
                progress = progressEvent?.stepCount?.let { it * 10 }?.coerceAtMost(100) ?: 0,
                currentStep = progressEvent?.step,
                lastLog = agent.logs.lastOrNull()?.message,
                logs = agent.logs,
                threads = agent.threads
            )
        }
    }
}

data class AgentProgressEvent(
    val step: String,
    val stepCount: Int,
    val actionType: String? = null
)
