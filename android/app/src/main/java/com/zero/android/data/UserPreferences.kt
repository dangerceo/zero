package com.zero.android.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "zero_settings")

class UserPreferences(context: Context) {
    private val dataStore = context.dataStore

    private val baseUrlKey = stringPreferencesKey("base_url")
    private val monitoringKey = booleanPreferencesKey("monitoring_enabled")

    val baseUrlFlow: Flow<String?> = dataStore.data.map { prefs ->
        prefs[baseUrlKey]
    }

    val monitoringEnabledFlow: Flow<Boolean> = dataStore.data.map { prefs ->
        prefs[monitoringKey] ?: false
    }

    suspend fun setBaseUrl(url: String) {
        dataStore.edit { prefs ->
            prefs[baseUrlKey] = url
        }
    }

    suspend fun clearBaseUrl() {
        dataStore.edit { prefs ->
            prefs.remove(baseUrlKey)
        }
    }

    suspend fun setMonitoringEnabled(enabled: Boolean) {
        dataStore.edit { prefs ->
            prefs[monitoringKey] = enabled
        }
    }
}
