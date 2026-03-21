package com.zero.android.data.model

data class ChatProject(
    val id: String,
    val name: String,
    val status: String,
    val logs: List<AgentLog> = emptyList(),
    val threads: List<ThreadEntry> = emptyList()
)
