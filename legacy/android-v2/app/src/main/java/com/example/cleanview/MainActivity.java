package com.example.cleanview;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity
        implements TextToSpeech.OnInitListener {

    private static final int VOICE_REQUEST = 101;

    // ── Views ─────────────────────────────────────────────────────
    private WebView      webView;
    private RecyclerView focusListView;
    private ProgressBar  progressBar;
    private View         homeLayout;
    private View         bottomNav;
    private Button       btnHomeSearch;
    private Button       btnHomeFocus;
    private Button       navHome;
    private Button       navToggle;

    // ── Subsystems ────────────────────────────────────────────────
    private TextToSpeech          tts;
    private boolean               ttsReady  = false;
    private FocusAdapter          focusAdapter;
    private LinearLayoutManager   layoutManager;
    private final ExecutorService executor  = Executors.newSingleThreadExecutor();

    // ── State ─────────────────────────────────────────────────────
    private boolean focusModeActive = false;
    private boolean focusPrimed     = false;

    // ══════════════════════════════════════════════════════════════
    //  LIFECYCLE
    // ══════════════════════════════════════════════════════════════

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.BLACK);
        }
        setContentView(R.layout.activity_main);

        bindViews();
        initTts();
        initWebView();
        initFocusList();
        wireListeners();

        narrate("CleanView ready.");
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        executor.shutdownNow();
        super.onDestroy();
    }

    // ══════════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════════

    private void bindViews() {
        webView        = findViewById(R.id.webView);
        focusListView  = findViewById(R.id.focusListView);
        progressBar    = findViewById(R.id.progressBar);
        homeLayout     = findViewById(R.id.homeLayout);
        bottomNav      = findViewById(R.id.bottomNav);
        btnHomeSearch  = findViewById(R.id.btnHomeSearch);
        btnHomeFocus   = findViewById(R.id.btnHomeFocus);
        navHome        = findViewById(R.id.navHome);
        navToggle      = findViewById(R.id.navToggle);
    }

    private void initTts() {
        tts = new TextToSpeech(this, this);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int res = tts.setLanguage(Locale.US);
            ttsReady = (res != TextToSpeech.LANG_MISSING_DATA
                    && res != TextToSpeech.LANG_NOT_SUPPORTED);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initWebView() {
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setBackgroundColor(Color.BLACK);
        webView.setWebViewClient(new SemanticRepairClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                progressBar.setVisibility(
                        progress < 100 ? View.VISIBLE : View.GONE);
            }
        });
    }

    private void initFocusList() {
        layoutManager = new LinearLayoutManager(this);
        focusAdapter  = new FocusAdapter(new ArrayList<>(), this::onItemTapped);
        focusListView.setLayoutManager(layoutManager);
        focusListView.setAdapter(focusAdapter);
    }

    private void wireListeners() {
        // Home screen: standard search
        btnHomeSearch.setOnClickListener(v -> {
            focusPrimed = false;
            startVoiceSearch();
        });

        // Home screen: search and open in Focus Mode
        btnHomeFocus.setOnClickListener(v -> {
            focusPrimed = true;
            narrate("Focus Mode primed.");
            startVoiceSearch();
        });

        // Bottom nav: go home
        navHome.setOnClickListener(v -> goHome());

        // Bottom nav: toggle between web and focus views
        navToggle.setOnClickListener(v -> toggleFocusMode());
    }

    // ══════════════════════════════════════════════════════════════
    //  NAVIGATION
    // ══════════════════════════════════════════════════════════════

    private void goHome() {
        tts.stop();
        webView.stopLoading();
        webView.loadUrl("about:blank");

        homeLayout.setVisibility(View.VISIBLE);
        webView.setVisibility(View.GONE);
        focusListView.setVisibility(View.GONE);
        bottomNav.setVisibility(View.GONE);

        focusModeActive = false;
        focusPrimed     = false;

        narrate("Home.");
    }

    private void toggleFocusMode() {
        focusModeActive = !focusModeActive;

        if (focusModeActive) {
            webView.setVisibility(View.GONE);
            focusListView.setVisibility(View.VISIBLE);
            navToggle.setText("WEB MODE");
            narrate("Focus Mode active.");
        } else {
            focusListView.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            navToggle.setText("FOCUS MODE");
            narrate("Web view restored.");
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  WEBCLIENT — Semantic Repair Entry Point
    // ══════════════════════════════════════════════════════════════

    private class SemanticRepairClient extends WebViewClient {

        @Override
        public void onPageFinished(WebView view, String url) {

            // ── Skip Google intermediary pages ────────────────────
            // google.com/search  = the results page (btnI=1 hasn't
            //                      redirected yet, nothing to parse)
            // about:blank        = goHome() cleared the WebView
            if (url.contains("google.com/search") || url.equals("about:blank")) {
                return;
            }

            // ── Handle Google's redirect wrapper ──────────────────
            // When &btnI=1 routes through google.com/url?q=TARGET,
            // extract the real destination URL from the query param
            // and load it directly — more reliable than clicking a link.
            if (url.contains("google.com/url?")) {
                String realUrl = extractGoogleRedirectUrl(url);
                if (realUrl != null) {
                    view.loadUrl(realUrl);
                }
                return;
            }

            // ── Real destination page has loaded ──────────────────
            runOnUiThread(() -> {
                homeLayout.setVisibility(View.GONE);
                bottomNav.setVisibility(View.VISIBLE);

                if (focusPrimed) {
                    webView.setVisibility(View.GONE);
                    focusListView.setVisibility(View.VISIBLE);
                    focusModeActive = true;
                    navToggle.setText("WEB MODE");   // FIX D: set correct label
                } else {
                    webView.setVisibility(View.VISIBLE);
                    focusListView.setVisibility(View.GONE);
                    focusModeActive = false;
                    navToggle.setText("FOCUS MODE"); // FIX D: set correct label
                }
            });

            // ── Capture HTML for Jsoup parsing ────────────────────
            // Always parse so Focus Mode is ready even if user starts
            // in Web Mode and toggles later.
            view.evaluateJavascript(
                "(function(){ return document.documentElement.outerHTML; })()",
                html -> {
                    if (html == null || html.length() <= 2) return;
                    String clean = html
                            .substring(1, html.length() - 1)
                            .replace("\\u003C", "<")
                            .replace("\\u003E", ">")
                            .replace("\\\"",    "\"")
                            .replace("\\n",     "\n")
                            .replace("\\\\",    "\\");
                    parseFocusMode(clean);
                }
            );
        }
    }

    /**
     * Extracts the real destination URL from a Google redirect URL.
     * google.com/url?q=https%3A%2F%2Ftarget.com&... → https://target.com
     * More reliable than clicking a DOM element on the redirect page.
     */
    private String extractGoogleRedirectUrl(String googleUrl) {
        try {
            android.net.Uri uri = android.net.Uri.parse(googleUrl);
            String q = uri.getQueryParameter("q");
            if (q != null && (q.startsWith("http://") || q.startsWith("https://"))) {
                return q;
            }
        } catch (Exception e) {
            // If parsing fails, fall through and return null
        }
        return null;
    }

    // ══════════════════════════════════════════════════════════════
    //  FOCUS MODE PARSER — Jsoup extraction + summarization
    // ══════════════════════════════════════════════════════════════

    /**
     * Parses the page HTML on a background thread.
     * Extracts h1/h2/h3 and p tags, filters noise, summarizes paragraphs.
     * Publishes results to the UI thread and triggers the intro narration.
     */
    private void parseFocusMode(String html) {
        executor.execute(() -> {
            Document doc = Jsoup.parse(html);

            // Remove structural noise before extracting content
            doc.select("nav, footer, header, aside, script, style, " +
                       "iframe, [class*=ad], [id*=ad], [class*=menu], " +
                       "[class*=cookie], [class*=popup], [class*=banner]").remove();

            List<FocusItem> items = new ArrayList<>();
            String summaryText   = null; // first meaningful paragraph

            for (Element el : doc.select("h1, h2, h3, p")) {
                String raw = el.text().trim();

                // Filter 1: too short to be real content
                if (raw.length() < 20) continue;

                // Filter 2: common navigation / boilerplate strings
                if (raw.equalsIgnoreCase("Contents")
                        || raw.equalsIgnoreCase("References")
                        || raw.equalsIgnoreCase("See also")
                        || raw.equalsIgnoreCase("External links")) continue;

                String processed;
                FocusItem.Type type;

                if (el.tagName().startsWith("h")) {
                    // Headings: uppercase for visual prominence
                    type      = FocusItem.Type.HEADING_1;
                    processed = raw.toUpperCase();
                } else {
                    // Paragraphs: truncate to first two sentences
                    type      = FocusItem.Type.PARAGRAPH;
                    processed = truncateToTwoSentences(raw);

                    // Capture the first paragraph that is long enough
                    // to serve as a meaningful article summary (60+ chars)
                    if (summaryText == null && processed.length() >= 60) {
                        summaryText = processed;
                    }
                }

                items.add(new FocusItem(type, processed, ""));
            }

            // Snapshot for the intro narration closure
            final String summary      = summaryText;
            final int    itemCount    = items.size();
            final String headlineText = items.isEmpty() ? null
                                        : items.get(0).getText();

            runOnUiThread(() -> {
                focusAdapter.updateItems(items);

                if (itemCount == 0) {
                    narrate("The repair engine could not extract content from this page.");
                    return;
                }

                // ── Phase 1 + 2: Intro narration ─────────────────
                // Read title → summary → invitation to continue.
                // Uses QUEUE_ADD so all three parts play in sequence
                // without interrupting each other.
                if (headlineText != null) {
                    speakQueued(headlineText, "intro_title");
                }
                if (summary != null) {
                    speakQueued(summary, "intro_summary");
                }
                speakQueued("Tap any section to begin reading.", "intro_end");
            });
        });
    }

    /**
     * Truncates a paragraph string to its first two sentences.
     * Looks for ". " as a sentence boundary. Falls back to full text
     * if fewer than two sentence boundaries are found.
     */
    private String truncateToTwoSentences(String text) {
        int first = text.indexOf(". ");
        if (first == -1) return text; // only one sentence, keep all

        int second = text.indexOf(". ", first + 2);
        if (second == -1) return text; // only two sentences, keep all

        return text.substring(0, second + 1); // cut after second sentence
    }

    // ══════════════════════════════════════════════════════════════
    //  TAP-TO-READ FLOW
    // ══════════════════════════════════════════════════════════════

    /**
     * Called when the user taps any item in the Focus Mode list.
     * Jumps TTS to that item, highlights it, and scrolls it into view.
     * If TTS is mid-read, it interrupts and starts from the tapped item.
     */
    private void onItemTapped(FocusItem item) {
        int position = focusAdapter.indexOf(item);
        if (position == -1) return;

        // Update highlight and scroll to item
        focusAdapter.setActiveIndex(position);
        layoutManager.scrollToPositionWithOffset(position, 80);

        // Interrupt any current speech and read this item
        tts.stop();
        narrate(item.getText());
    }

    // ══════════════════════════════════════════════════════════════
    //  VOICE SEARCH
    // ══════════════════════════════════════════════════════════════

    private void startVoiceSearch() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        startActivityForResult(intent, VOICE_REQUEST);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VOICE_REQUEST
                && resultCode == RESULT_OK
                && data != null) {
            ArrayList<String> results =
                    data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (results != null && !results.isEmpty()) {
                String input = results.get(0).toLowerCase(Locale.US);
                narrate("Searching for " + input + ". Please wait.");
                String url = "https://www.google.com/search?q="
                        + input.replace(" ", "+") + "&btnI=1";
                webView.loadUrl(url);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  TTS HELPERS
    // ══════════════════════════════════════════════════════════════

    /**
     * Speaks text immediately, interrupting anything currently playing.
     * Use for one-off announcements and responses to user actions.
     */
    public void narrate(String text) {
        if (ttsReady && tts != null && text != null && !text.isEmpty()) {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "cv_now");
        }
    }

    /**
     * Adds text to the TTS queue without interrupting current speech.
     * Use for the multi-part intro sequence (title → summary → invitation).
     * Each call gets a unique utterance ID for progress tracking.
     */
    private void speakQueued(String text, String utteranceId) {
        if (ttsReady && tts != null && text != null && !text.isEmpty()) {
            tts.speak(text, TextToSpeech.QUEUE_ADD, null, utteranceId);
        }
    }
}
