package com.marinov.tetris;

import android.annotation.SuppressLint;
import android.app.UiModeManager;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;

    @SuppressLint("SourceLockedOrientationActivity")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.webView);
        setupWebView();

        webView.loadUrl("file:///android_asset/index.html");

        UiModeManager uiModeManager = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        boolean isTV = uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (isTV) {
                    // Na TV, voltar durante a partida pausa o jogo em vez de sair
                    webView.evaluateJavascript(
                            "if (typeof gameState !== 'undefined' && gameState === 'playing') {" +
                                    "    pauseGame(); 'paused';" +
                                    "} else { 'passthrough'; }",
                            result -> {
                                // Se não estava jogando, segue o fluxo normal
                                if ("\"passthrough\"".equals(result)) {
                                    finish();
                                }
                            }
                    );
                } else {
                    if (webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        finish();
                    }
                }
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setScrollbarFadingEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webView.resumeTimers();

        webView.evaluateJavascript(
                "if (typeof gameState !== 'undefined' && gameState === 'welcome') {" +
                        "    audio_menu.play().catch(e => {});" +
                        "}",
                null
        );
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.evaluateJavascript(
                "if (typeof gameState !== 'undefined') {" +
                        "    if (gameState === 'playing') {" +
                        "        pauseGame();" +          // pausa o jogo e o audio_game
                        "    } else {" +
                        "        audio_menu.pause();" +   // welcome ou gameover: só pausa o áudio
                        "        audio_game.pause();" +
                        "    }" +
                        "}",
                null
        );
        webView.onPause();
        webView.pauseTimers();
    }
    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}