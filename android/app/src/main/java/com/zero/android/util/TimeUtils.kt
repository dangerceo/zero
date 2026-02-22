package com.zero.android.util

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val formatter: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, HH:mm")
    .withZone(ZoneId.systemDefault())

fun formatIsoTime(isoString: String?): String {
    if (isoString.isNullOrBlank()) return ""
    return try {
        formatter.format(Instant.parse(isoString))
    } catch (_: Exception) {
        ""
    }
}
