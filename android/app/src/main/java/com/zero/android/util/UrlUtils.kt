package com.zero.android.util

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

fun normalizeBaseUrl(input: String): String? {
    val trimmed = input.trim()
    if (trimmed.isBlank()) return null

    val normalizedScheme = when {
        trimmed.startsWith("ws://") -> "http://${trimmed.removePrefix("ws://")}"
        trimmed.startsWith("wss://") -> "https://${trimmed.removePrefix("wss://")}"
        trimmed.startsWith("http://") || trimmed.startsWith("https://") -> trimmed
        else -> "http://$trimmed"
    }

    val url = normalizedScheme.toHttpUrlOrNull() ?: return null
    val normalized = url.newBuilder()
        .encodedPath("/")
        .query(null)
        .fragment(null)
        .build()

    return normalized.toString()
}

fun baseUrlToWebSocketUrl(baseUrl: String): String {
    val trimmed = baseUrl.trim()
    if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
        return trimmed
    }
    val httpUrl = trimmed.toHttpUrlOrNull() ?: return trimmed
    val newScheme = if (httpUrl.isHttps) "wss" else "ws"
    return httpUrl.toString().replaceFirst(httpUrl.scheme, newScheme)
}
