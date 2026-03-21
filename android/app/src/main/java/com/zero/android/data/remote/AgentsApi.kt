package com.zero.android.data.remote

import com.zero.android.data.model.Agent
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface AgentsApi {
    @GET("api/agents")
    suspend fun getAgents(): List<Agent>

    @GET("api/agy/projects")
    suspend fun getAgyProjects(): List<com.zero.android.data.model.AgyProject>

    @POST("api/agents")
    suspend fun createAgent(@Body request: CreateAgentRequest): Agent

    @POST("api/agents/{id}/start")
    suspend fun startAgent(@Path("id") id: String): Map<String, String>

    @POST("api/agents/{id}/todo")
    suspend fun addTodo(@Path("id") id: String, @Body request: TodoRequest): Agent

    @POST("api/agents/{id}/intervene")
    suspend fun intervene(@Path("id") id: String, @Body request: InterventionResponse): Agent

    @POST("api/agents/{id}/deploy")
    suspend fun deploy(@Path("id") id: String): Map<String, Any>

    @GET("api/interventions")
    suspend fun getInterventions(): List<com.zero.android.data.model.Intervention>

    @POST("api/agents/{id}/questions/{qid}/answer")
    suspend fun answerQuestion(
        @Path("id") id: String,
        @Path("qid") qid: String,
        @Body request: AnswerRequest
    ): Agent

    @POST("api/notifications")
    suspend fun syncNotification(@Body payload: Map<String, String>)
}

data class CreateAgentRequest(
    val goal: String,
    val name: String? = null,
    val workingDir: String? = null,
    val files: List<com.zero.android.data.model.AgentFile> = emptyList()
)

data class TodoRequest(
    val todo: String
)

data class AnswerRequest(
    val answer: String
)

data class InterventionResponse(
    val interventionId: String,
    val response: String
)
