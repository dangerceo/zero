package com.zero.android

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.zero.android.data.remote.WebSocketEventParser
import com.zero.android.data.remote.WsEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WebSocketEventParserTest {
    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    @Test
    fun parsesProjectUpdated() {
        val json = """
            {
              "type": "project:updated",
              "project": {
                "id": "p1",
                "name": "Test",
                "status": "working",
                "confidence": 80,
                "logs": []
              }
            }
        """.trimIndent()

        val event = WebSocketEventParser.parse(json, moshi)
        assertTrue(event is WsEvent.ProjectUpdated)
        val project = (event as WsEvent.ProjectUpdated).project
        assertEquals("p1", project.id)
        assertEquals("Test", project.name)
        assertEquals("working", project.status)
    }

    @Test
    fun parsesProjectProgress() {
        val json = """
            {
              "type": "project:progress",
              "projectId": "p1",
              "step": "Installing deps",
              "stepCount": 3,
              "actionType": "installing"
            }
        """.trimIndent()

        val event = WebSocketEventParser.parse(json, moshi)
        assertTrue(event is WsEvent.ProjectProgressEvent)
        val progress = event as WsEvent.ProjectProgressEvent
        assertEquals("p1", progress.projectId)
        assertEquals("Installing deps", progress.step)
        assertEquals(3, progress.stepCount)
    }

    @Test
    fun parsesTaskUpdated() {
        val json = """
            {
              "type": "task:updated",
              "task": {
                "id": "t1",
                "description": "Do thing",
                "status": "running",
                "progress": 40,
                "logs": []
              }
            }
        """.trimIndent()

        val event = WebSocketEventParser.parse(json, moshi)
        assertTrue(event is WsEvent.TaskUpdated)
        val task = (event as WsEvent.TaskUpdated).task
        assertEquals("t1", task.id)
        assertEquals("Do thing", task.description)
        assertEquals("running", task.status)
    }
}
