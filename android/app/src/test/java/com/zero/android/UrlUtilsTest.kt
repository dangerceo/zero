package com.zero.android

import com.zero.android.util.baseUrlToWebSocketUrl
import com.zero.android.util.normalizeBaseUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UrlUtilsTest {
    @Test
    fun normalizeBaseUrlAddsSchemeAndSlash() {
        val normalized = normalizeBaseUrl("192.168.1.100:3847")
        assertEquals("http://192.168.1.100:3847/", normalized)
    }

    @Test
    fun normalizeBaseUrlStripsPath() {
        val normalized = normalizeBaseUrl("http://example.com/some/path")
        assertEquals("http://example.com/", normalized)
    }

    @Test
    fun normalizeBaseUrlRejectsInvalid() {
        val normalized = normalizeBaseUrl("not a url")
        assertNull(normalized)
    }

    @Test
    fun baseUrlToWebSocketUrlConvertsHttpsToWss() {
        val wsUrl = baseUrlToWebSocketUrl("https://example.com/")
        assertEquals("wss://example.com/", wsUrl)
    }

    @Test
    fun baseUrlToWebSocketUrlConvertsHttpToWs() {
        val wsUrl = baseUrlToWebSocketUrl("http://example.com/")
        assertEquals("ws://example.com/", wsUrl)
    }

    @Test
    fun normalizeBaseUrlConvertsWebSocketScheme() {
        val normalized = normalizeBaseUrl("ws://192.168.1.100:3847")
        assertEquals("http://192.168.1.100:3847/", normalized)
    }
}
