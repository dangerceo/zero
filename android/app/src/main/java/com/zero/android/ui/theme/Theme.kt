package com.zero.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = ZeroPrimary,
    secondary = ZeroSecondary,
    background = ZeroDark,
    surface = ZeroSurface,
    onPrimary = ZeroLight,
    onSecondary = ZeroLight,
    onBackground = ZeroLight,
    onSurface = ZeroLight,
    error = ZeroError
)

private val LightColorScheme = lightColorScheme(
    primary = ZeroPrimary,
    secondary = ZeroSecondary,
    background = ZeroLight,
    surface = ZeroSurfaceLight,
    onPrimary = ZeroLight,
    onSecondary = ZeroLight,
    onBackground = ZeroDark,
    onSurface = ZeroDark,
    error = ZeroError
)

@Composable
fun ZeroTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = if (isSystemInDarkTheme()) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
