package com.zero.android.data.model

data class AgyProject(
    val id: String,
    val name: String,
    val type: String,
    val status: String,
    val age: String? = null,
    val hasWalkthrough: Boolean? = null,
    val logs: List<AgentLog> = emptyList(),
    val threads: List<ThreadEntry> = emptyList()
)
