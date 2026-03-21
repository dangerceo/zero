package com.zero.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.zero.android.data.AgentsRepository
import com.zero.android.data.AppContainer
import com.zero.android.data.model.AgentUiModel
import com.zero.android.data.model.ConnectionState
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class MainViewModel(private val container: AppContainer) : ViewModel() {
    private val _agents = MutableStateFlow<List<AgentUiModel>>(emptyList())
    val agents: StateFlow<List<AgentUiModel>> = _agents.asStateFlow()

    private val _connection = MutableStateFlow(ConnectionState.Disconnected)
    val connection: StateFlow<ConnectionState> = _connection.asStateFlow()

    private val _interventions = MutableStateFlow<List<com.zero.android.data.model.Intervention>>(emptyList())
    val interventions: StateFlow<List<com.zero.android.data.model.Intervention>> = _interventions.asStateFlow()

    private val _agyProjects = MutableStateFlow<List<com.zero.android.data.model.AgyProject>>(emptyList())
    val agyProjects: StateFlow<List<com.zero.android.data.model.AgyProject>> = _agyProjects.asStateFlow()

    private val _baseUrl = MutableStateFlow<String?>(null)
    val baseUrl: StateFlow<String?> = _baseUrl.asStateFlow()

    private val _monitoringEnabled = MutableStateFlow(false)
    val monitoringEnabled: StateFlow<Boolean> = _monitoringEnabled.asStateFlow()

    private var repository: AgentsRepository? = null
    private var repositoryJobs: List<Job> = emptyList()

    init {
        viewModelScope.launch {
            container.userPreferences.baseUrlFlow.collectLatest { url ->
                _baseUrl.value = url
                updateRepositories(url)
            }
        }
        viewModelScope.launch {
            container.userPreferences.monitoringEnabledFlow.collectLatest { enabled ->
                _monitoringEnabled.value = enabled
            }
        }
    }

    fun refresh() {
        repository?.refresh()
    }

    fun createAgent(goal: String, isMeta: Boolean = false) {
        viewModelScope.launch {
            repository?.createAgent(goal, isMeta)
            refreshInterventions()
        }
    }

    fun intervene(agentId: String, interventionId: String, response: String) {
        viewModelScope.launch {
            repository?.intervene(agentId, interventionId, response)
            refreshInterventions()
        }
    }

    private fun refreshInterventions() {
        viewModelScope.launch {
            _interventions.value = repository?.getInterventions() ?: emptyList()
        }
    }

    fun addTodo(agentId: String, todo: String) {
        viewModelScope.launch {
            repository?.addTodo(agentId, todo)
        }
    }

    fun setBaseUrl(url: String) {
        viewModelScope.launch {
            container.userPreferences.setBaseUrl(url)
        }
    }

    fun clearBaseUrl() {
        viewModelScope.launch {
            container.userPreferences.clearBaseUrl()
        }
    }

    fun setMonitoringEnabled(enabled: Boolean) {
        viewModelScope.launch {
            container.userPreferences.setMonitoringEnabled(enabled)
        }
    }

    private fun updateRepositories(url: String?) {
        repositoryJobs.forEach { it.cancel() }
        repositoryJobs = emptyList()
        repository?.stop()
        repository = null
        _agents.value = emptyList()
        _connection.value = ConnectionState.Disconnected

        if (url.isNullOrBlank()) return

        val repo = AgentsRepository(url, container.okHttpClient, container.moshi, viewModelScope)
        repository = repo
        repo.start()
        refreshInterventions()
        
        val job1 = viewModelScope.launch {
            repo.agents.collectLatest { _agents.value = it }
        }
        val job2 = viewModelScope.launch {
            repo.connection.collectLatest { _connection.value = it }
        }
        val job3 = viewModelScope.launch {
            repo.agyProjects.collectLatest { _agyProjects.value = it }
        }
        repositoryJobs = listOf(job1, job2, job3)
    }
}

class MainViewModelFactory(private val container: AppContainer) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MainViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return MainViewModel(container) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
