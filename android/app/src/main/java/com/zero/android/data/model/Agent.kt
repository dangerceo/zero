package com.zero.android.data.model

data class Agent(
    val id: String,
    val name: String,
    val goal: String? = null,
    val status: String,
    val workingDir: String? = null,
    val files: List<AgentFile> = emptyList(),
    val threads: List<ThreadEntry> = emptyList(),
    val checkpoints: List<Checkpoint> = emptyList(),
    val logs: List<AgentLog> = emptyList(),
    val createdAt: String? = null,
    val updatedAt: String? = null
)

data class AgentFile(
    val path: String,
    val description: String? = null
)

data class ThreadEntry(
    val id: String,
    val role: String,
    val content: String,
    val timestamp: String,
    val metadata: Map<String, Any>? = null
)

data class Checkpoint(
    val id: String,
    val summary: String,
    val createdAt: String
)

data class AgentLog(
    val message: String,
    val type: String,
    val timestamp: String
)
