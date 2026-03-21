package com.zero.android

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.zero.android.data.remote.WebSocketEventParser
import com.zero.android.data.remote.WsEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WebSocketEventParserTest {
    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    @Test
    fun parsesAgentUpdated() {
        val json = """
            {
              "type": "agent:updated",
              "agent": {
                "id": "a1",
                "name": "Test",
                "status": "running"
              }
            }
        """.trimIndent()

        val event = WebSocketEventParser.parse(json, moshi)
        assertNotNull("Event should not be null", event)
        assertTrue("Event should be AgentUpdated, but was ${event?.javaClass?.simpleName}", event is WsEvent.AgentUpdated)
        val agent = (event as WsEvent.AgentUpdated).agent
        assertEquals("a1", agent.id)
        assertEquals("Test", agent.name)
        assertEquals("running", agent.status)
    }

    @Test
    fun parsesAgentProgress() {
        val json = """
            {
              "type": "agent:progress",
              "agentId": "a1",
              "step": "Installing deps",
              "stepCount": 3,
              "actionType": "installing"
            }
        """.trimIndent()

        val event = WebSocketEventParser.parse(json, moshi)
        assertNotNull("Event should not be null", event)
        assertTrue("Event should be AgentProgressEvent, but was ${event?.javaClass?.simpleName}", event is WsEvent.AgentProgressEvent)
        val progress = event as WsEvent.AgentProgressEvent
        assertEquals("a1", progress.agentId)
        assertEquals("Installing deps", progress.step)
        assertEquals(3, progress.stepCount)
    }
}
