package com.zero.android.data.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Intervention(
    val id: String,
    val agentId: String,
    val agentName: String?,
    val type: String, // input, choice, confirm
    val message: String,
    val options: List<InterventionChoice> = emptyList(),
    val createdAt: String,
    val resolved: Boolean,
    val response: String?,
    val resolvedAt: String?
)

@JsonClass(generateAdapter = true)
data class InterventionChoice(
    val label: String,
    val value: String
)
