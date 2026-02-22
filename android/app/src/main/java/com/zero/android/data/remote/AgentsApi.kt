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

    @POST("api/agents/{id}/comment")
    suspend fun addComment(@Path("id") id: String, @Body request: CommentRequest): Agent

    @POST("api/agents/{id}/questions/{qid}/answer")
    suspend fun answerQuestion(
        @Path("id") id: String,
        @Path("qid") qid: String,
        @Body request: AnswerRequest
    ): Agent
}

data class CreateAgentRequest(
    val goal: String,
    val name: String? = null,
    val files: List<com.zero.android.data.model.AgentFile> = emptyList()
)

data class CommentRequest(
    val comment: String
)

data class AnswerRequest(
    val answer: String
)
