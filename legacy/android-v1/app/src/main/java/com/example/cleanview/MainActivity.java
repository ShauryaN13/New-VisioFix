package com.example.cleanview;

/*
 * ════════════════════════════════════════════════════════════════════
 *  CleanView — Semantic Repair Accessibility Browser
 *  MainActivity.java  |  MVP Build
 * ════════════════════════════════════════════════════════════════════
 *
 *  MVP PILLARS (in priority order)
 *  ────────────────────────────────
 *  1. JS SCRUBBER       — evaluateJavascript strips ads/clutter on every
 *                         onPageFinished. Returns JSON stats for TTS narration.
 *
 *  2. FOCUS MODE        — Jsoup extracts h1/h2/p/a from repaired HTML on a
 *                         background thread. Populates Yellow-on-Black
 *                         RecyclerView. Two-finger double-tap to toggle.
 *
 *  3. VOICE + TTS       — RecognizerIntent for hands-free URL/search input.
 *                         Shake-to-search via SensorManager. TTS narrates
 *                         every state change.
 *
 *  DEFERRED (post-MVP)
 *  ────────────────────
 *  • Haptic Compass (finger-tracking element detection)
 * ════════════════════════════════════════════════════════════════════
 */

import android.annotation.SuppressLint;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.view.animation.AlphaAnimation;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity
        implements TextToSpeech.OnInitListener, SensorEventListener {

    private static final String TAG            = "CleanView";
    private static final int    VOICE_REQUEST  = 101;

    // Shake: 12.0f filters out hand tremor, catches deliberate shake
    private static final float  SHAKE_THRESHOLD = 12.0f;
    private static final long   SHAKE_COOLDOWN  = 1500L;

    // Two-finger double-tap: two ACTION_UP events within 400ms
    private static final long   TWO_FINGER_SLOP = 400L;

    // ── Views ─────────────────────────────────────────────────────
    private WebView      webView;
    private RecyclerView focusListView;
    private ImageButton  voiceSearchButton;
    private ProgressBar  progressBar;
    private TextView     tvStatusBadge;
    private TextView     tvUrlBar;

    // ── Subsystems ────────────────────────────────────────────────
    private TextToSpeech   tts;
    private boolean        ttsReady     = false;
    private Vibrator       vibrator;
    private SensorManager  sensorManager;
    private Sensor         accelerometer;
    private FocusAdapter   focusAdapter;

    // Single-thread executor for Jsoup — background parse, UI publish
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    // ── State ─────────────────────────────────────────────────────
    private boolean focusModeActive  = false;
    private String  currentPageHtml  = "";
    private String  lastParsedUrl    = "";
    private long    lastShakeTime    = 0L;
    private long    lastTwoFingerTap = 0L;

    // ══════════════════════════════════════════════════════════════
    //  LIFECYCLE
    // ══════════════════════════════════════════════════════════════

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bindViews();
        initTts();
        initVibrator();
        initSensors();
        initWebView();
        initFocusList();
        wireListeners();

        // Default page — load BBC News as the launch URL
        webView.loadUrl("https://www.bbc.com/news");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (sensorManager != null && accelerometer != null) {
            sensorManager.registerListener(
                    this, accelerometer, SensorManager.SENSOR_DELAY_UI);
        }
        checkClipboardForUrl();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (sensorManager != null) sensorManager.unregisterListener(this);
    }

    @Override
    protected void onDestroy() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        if (tts != null) { tts.stop(); tts.shutdown(); }
        executor.shutdownNow();
        super.onDestroy();
    }

    // ══════════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════════

    private void bindViews() {
        webView           = findViewById(R.id.webView);
        focusListView     = findViewById(R.id.focusListView);
        voiceSearchButton = findViewById(R.id.voiceSearchButton);
        progressBar       = findViewById(R.id.progressBar);
        tvStatusBadge     = findViewById(R.id.tvStatusBadge);
        tvUrlBar          = findViewById(R.id.tvUrlBar);
    }

    private void initTts() {
        tts = new TextToSpeech(this, this);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int res = tts.setLanguage(Locale.US);
            ttsReady = res != TextToSpeech.LANG_MISSING_DATA
                    && res != TextToSpeech.LANG_NOT_SUPPORTED;
            if (ttsReady) {
                tts.setSpeechRate(0.85f);
                narrate("CleanView ready. Tap the microphone or shake the phone to search by voice.");
            }
        } else {
            Log.e(TAG, "TTS init failed, status=" + status);
        }
    }

    private void initVibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm =
                    (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            if (vm != null) vibrator = vm.getDefaultVibrator();
        } else {
            //noinspection deprecation
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        }
    }

    private void initSensors() {
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initWebView() {
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setLoadWithOverviewMode(true);
        webView.getSettings().setUseWideViewPort(true);
        webView.getSettings().setTextZoom(120);
        webView.setBackgroundColor(0xFF000000);
        webView.setWebViewClient(new SemanticRepairClient());

        // WebChromeClient drives the progress bar accurately (0–100 scale)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                progressBar.setVisibility(progress < 100 ? View.VISIBLE : View.GONE);
            }
        });
    }

    private void initFocusList() {
        focusAdapter = new FocusAdapter(new ArrayList<>(), this::onFocusItemSelected);
        focusListView.setLayoutManager(new LinearLayoutManager(this));
        focusListView.setAdapter(focusAdapter);
        focusListView.setVisibility(View.GONE);
    }

    private void wireListeners() {
        voiceSearchButton.setOnClickListener(v -> startVoiceSearch());
    }

    // ══════════════════════════════════════════════════════════════
    //  PILLAR 1 — JS SCRUBBER
    // ══════════════════════════════════════════════════════════════

    /**
     * SemanticRepairClient intercepts the page lifecycle.
     *
     * KEY DECISION: shouldOverrideUrlLoading returns FALSE.
     * Returning true and calling view.loadUrl() again causes every
     * link tap to load the page twice. False lets the engine handle
     * navigation natively — no double-load, no flicker.
     *
     * onPageFinished fires the scrubber via evaluateJavascript (NOT
     * loadUrl("javascript:...")). evaluateJavascript runs the script
     * inside the current page context without triggering a new
     * navigation, so onPageFinished is NOT called again → no loop.
     */
    private class SemanticRepairClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            tvUrlBar.setText(trimUrl(req.getUrl().toString()));
            return false; // let WebView handle navigation natively
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap fav) {
            super.onPageStarted(view, url, fav);
            tvUrlBar.setText(trimUrl(url));
            tvStatusBadge.setText("Loading…");
            narrate("Loading page.");
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);

            // ── STEP 1: Run the JS Scrubber ───────────────────────
            // The script self-executes and returns a JSON stats object.
            // evaluateJavascript delivers that JSON string to the callback.
            view.evaluateJavascript(buildScrubberScript(), result -> {

                int removed  = extractInt(result, "removed");
                int headings = extractInt(result, "headings");
                int labelled = extractInt(result, "labelled");

                Log.d(TAG, "Scrubber: removed=" + removed
                        + " headings=" + headings
                        + " labelled=" + labelled);

                runOnUiThread(() -> {
                    tvStatusBadge.setText("−" + removed + " ads · " + headings + " headings");
                    hapticHeaderPulse(); // double-pulse = page ready
                    narrate("Page loaded. Removed " + removed
                            + " distractions. Found " + headings
                            + " headings. Two-finger double-tap for Focus Mode.");
                });

                // ── STEP 2: Capture repaired HTML ─────────────────
                // Chained inside the scrubber callback so the DOM has
                // already been cleaned before we snapshot it for Jsoup.
                view.evaluateJavascript(
                    "(function(){ return document.documentElement.outerHTML; })()",
                    html -> {
                        if (html != null && html.length() > 2) {
                            // evaluateJavascript wraps the return in JSON quotes;
                            // strip them and unescape the HTML entities.
                            currentPageHtml = html
                                    .substring(1, html.length() - 1)
                                    .replace("\\u003C", "<")
                                    .replace("\\u003E", ">")
                                    .replace("\\\"",    "\"")
                                    .replace("\\n",     "\n")
                                    .replace("\\\\",    "\\");

                            // Only re-parse Jsoup when the URL has changed
                            if (!url.equals(lastParsedUrl)) {
                                lastParsedUrl = url;
                                parseFocusMode(currentPageHtml);
                            }
                        }
                    }
                );
            });
        }
    }

    /**
     * Builds the self-executing JavaScript scrubber.
     *
     * THREE PHASES:
     *   Phase 1 — DOM Scrubber: removes ad/popup/clutter nodes before
     *             the user can encounter them. Operates in 4 tiers:
     *             element types → generic class/id patterns →
     *             known ad-network signatures → aria-hidden noise.
     *
     *   Phase 2 — Semantic Labeller: patches buttons and links that
     *             lack aria-label so TalkBack can announce them.
     *
     *   Phase 3 — Image Audit: adds placeholder alt text to images
     *             missing it, preventing TalkBack from reading filenames.
     *
     * Returns a JSON object so the Java callback gets stats without
     * any URL-scheme hacks.
     */
    private String buildScrubberScript() {
        return "(function() {\n"

            // ── Phase 1: DOM Scrubber ─────────────────────────────
            + "  var removed = 0;\n"
            + "  var selectors = [\n"

            // Tier 1 — element types almost exclusively used for ad delivery
            + "    'iframe',\n"
            + "    'ins',\n"                          // AdSense container tag
            + "    'ins.adsbygoogle',\n"

            // Tier 2 — generic class/ID patterns across all major ad networks
            + "    '[class*=\"ad-\"]',\n"
            + "    '[class*=\"-ad\"]',\n"
            + "    '[id*=\"ad-\"]',\n"
            + "    '[id*=\"-ad\"]',\n"
            + "    '[class*=\"advert\"]',\n"
            + "    '[id*=\"advert\"]',\n"
            + "    '[class*=\"popup\"]',\n"
            + "    '[id*=\"popup\"]',\n"
            + "    '[class*=\"banner\"]',\n"
            + "    '[id*=\"banner\"]',\n"
            + "    '[class*=\"overlay\"]',\n"
            + "    '[id*=\"overlay\"]',\n"
            + "    '[class*=\"modal\"]',\n"
            + "    '[id*=\"modal\"]',\n"
            + "    '[class*=\"cookie\"]',\n"          // cookie consent banners
            + "    '[id*=\"cookie\"]',\n"
            + "    '[class*=\"newsletter\"]',\n"      // email signup overlays
            + "    '[class*=\"subscribe\"]',\n"

            // Tier 3 — known ad-network SDK signatures
            + "    '[id*=\"google_ads\"]',\n"
            + "    '[id*=\"gpt-ad\"]',\n"            // Google Publisher Tags
            + "    'div[data-ad]',\n"
            + "    'div[data-google-query-id]',\n"
            + "    '[class*=\"dfp\"]',\n"            // DoubleClick for Publishers
            + "    '[class*=\"taboola\"]',\n"
            + "    '[class*=\"outbrain\"]',\n"
            + "    '[class*=\"sponsored\"]'\n"
            + "  ];\n"
            + "\n"
            + "  selectors.forEach(function(sel) {\n"
            + "    try {\n"
            + "      document.querySelectorAll(sel).forEach(function(el) {\n"
            + "        el.remove(); removed++;\n"
            + "      });\n"
            + "    } catch(e) {}\n"   // guard against invalid selectors on odd pages
            + "  });\n"
            + "\n"

            // ── Phase 2: Semantic Labeller ────────────────────────
            // Patches missing aria-labels on interactive elements.
            // Priority chain: aria-label → innerText → title → name → fallback.
            + "  var labelled = 0;\n"
            + "  document.querySelectorAll('button, a, [role=\"button\"]')\n"
            + "    .forEach(function(el) {\n"
            + "      var name = (el.getAttribute('aria-label') || el.innerText || '').trim();\n"
            + "      if (!name || name.length < 2) {\n"
            + "        var label = el.getAttribute('title')\n"
            + "                  || el.getAttribute('name')\n"
            + "                  || el.getAttribute('placeholder')\n"
            + "                  || (el.tagName === 'BUTTON' ? 'Button' : 'Link');\n"
            + "        el.setAttribute('aria-label', label);\n"
            + "        labelled++;\n"
            + "      }\n"
            + "  });\n"
            + "\n"

            // ── Phase 3: Image Audit ──────────────────────────────
            // Prevents TalkBack from reading raw filenames like "img_3847.jpg"
            + "  document.querySelectorAll('img').forEach(function(img) {\n"
            + "    var alt = img.getAttribute('alt');\n"
            + "    if (alt === null || alt.trim() === '') {\n"
            + "      img.setAttribute('alt', '[Image: Needs Description]');\n"
            + "    }\n"
            + "  });\n"
            + "\n"

            // Return JSON stats to the Java evaluateJavascript callback
            + "  var headings = document.querySelectorAll('h1,h2,h3').length;\n"
            + "  return JSON.stringify({\n"
            + "    removed:  removed,\n"
            + "    labelled: labelled,\n"
            + "    headings: headings\n"
            + "  });\n"
            + "})()";
    }

    // ══════════════════════════════════════════════════════════════
    //  PILLAR 2 — FOCUS MODE (Jsoup + Yellow-on-Black RecyclerView)
    // ══════════════════════════════════════════════════════════════

    /**
     * Parses repaired HTML into a flat semantic list using Jsoup.
     *
     * Runs on a background executor thread — Jsoup parsing a large
     * news page can take 100–300ms and must not block the UI thread.
     * Results are published back on the UI thread via runOnUiThread.
     *
     * Selector strategy:
     *   h1/h2  → structural headings (always included)
     *   p      → body paragraphs (min 40 chars — filters nav labels)
     *   a[href] → navigable links (absolute URLs via absUrl)
     */
    private void parseFocusMode(String html) {
        if (html == null || html.isEmpty()) return;

        executor.execute(() -> {
            try {
                Document doc = Jsoup.parse(html);

                // Strip remaining noise that JS scrubber may have missed
                // (Jsoup operates on the serialised HTML snapshot, not the
                //  live DOM, so some dynamically-injected elements may survive)
                doc.select("nav, footer, header, aside, script, style, " +
                           "iframe, ins, form, " +
                           "[class*=ad], [id*=ad], " +
                           "[class*=banner], [class*=popup], " +
                           "[class*=overlay], [class*=cookie], " +
                           "[class*=newsletter], [class*=subscribe]").remove();

                List<FocusItem> items = new ArrayList<>();
                Elements els = doc.select("h1, h2, p, a[href]");

                for (Element el : els) {
                    String text = el.text().trim();
                    if (text.isEmpty()) continue;

                    FocusItem.Type type;
                    switch (el.tagName()) {
                        case "h1": type = FocusItem.Type.HEADING_1; break;
                        case "h2": type = FocusItem.Type.HEADING_2; break;
                        case "a":  type = FocusItem.Type.LINK;      break;
                        default:
                            // Skip short strings — they're almost always
                            // navigation labels, not readable body content
                            if (text.length() < 40) continue;
                            type = FocusItem.Type.PARAGRAPH;
                            break;
                    }

                    // absUrl resolves relative hrefs to full URLs using
                    // the page's base URL — essential for link navigation
                    String href = el.absUrl("href");
                    items.add(new FocusItem(type, text, href));
                }

                final int count = items.size();
                runOnUiThread(() -> {
                    focusAdapter.updateItems(items);
                    Log.d(TAG, "Focus Mode: parsed " + count + " items");
                });

            } catch (Exception e) {
                Log.e(TAG, "Jsoup parse error", e);
                runOnUiThread(() ->
                        narrate("Focus mode could not parse this page."));
            }
        });
    }

    /**
     * Toggles between WebView (web mode) and RecyclerView (Focus Mode).
     * Two-finger double-tap triggers this from dispatchTouchEvent.
     */
    private void toggleFocusMode() {
        focusModeActive = !focusModeActive;
        hapticHeaderPulse(); // double-pulse = significant mode change

        if (focusModeActive) {
            crossFade(webView, focusListView);
            tvStatusBadge.setText("FOCUS MODE");

            int count = focusAdapter.getItemCount();
            if (count == 0 && !currentPageHtml.isEmpty()) {
                // Safety net: if pre-parse hasn't finished yet, run it now
                parseFocusMode(currentPageHtml);
                narrate("Focus Mode active. Parsing content, please wait.");
            } else {
                narrate("Focus Mode active. " + count
                        + " items. Two-finger double-tap to return.");
            }
        } else {
            crossFade(focusListView, webView);
            tvStatusBadge.setText("Web Mode");
            narrate("Web view restored.");
        }
    }

    /**
     * Called when the user taps a row in the Focus Mode list.
     * Links navigate the WebView; non-links are read aloud via TTS.
     */
    private void onFocusItemSelected(FocusItem item) {
        if (item.getType() == FocusItem.Type.LINK
                && item.getHref() != null
                && !item.getHref().isEmpty()) {
            String url = item.getHref();
            if (!url.startsWith("http")) url = "https://" + url;
            crossFade(focusListView, webView);
            focusModeActive = false;
            webView.loadUrl(url);
            hapticLinkPulse();
        } else {
            // Tap on a heading or paragraph → read it aloud
            narrate(item.getText());
            hapticLinkPulse();
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  PILLAR 3 — VOICE + TTS
    // ══════════════════════════════════════════════════════════════

    /**
     * Launches the system speech recogniser (Google, Samsung, etc.).
     * Triggered by: microphone button tap OR shake gesture.
     */
    private void startVoiceSearch() {
        narrate("Listening. Say a website name or search term.");
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_WEB_SEARCH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT,
                "Say a website or search term");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try {
            startActivityForResult(intent, VOICE_REQUEST);
        } catch (Exception e) {
            narrate("Voice recognition is not available on this device.");
            Log.w(TAG, "No speech recogniser found", e);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VOICE_REQUEST
                && resultCode == RESULT_OK
                && data != null) {
            List<String> results =
                    data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (results != null && !results.isEmpty()) {
                processVoiceInput(results.get(0).trim().toLowerCase(Locale.US));
            }
        }
    }

    /**
     * Converts raw voice transcript into a navigable URL.
     *
     * Rules:
     *   • Contains a dot, no spaces → treat as domain → prepend https://
     *   • Starts with http           → use as-is
     *   • Everything else            → Google Search
     */
    private void processVoiceInput(String input) {
        if (input == null || input.isEmpty()) return;
        String url;
        if (input.startsWith("http://") || input.startsWith("https://")) {
            url = input;
        } else if (input.contains(".") && !input.contains(" ")) {
            url = "https://" + input;
        } else {
            url = "https://www.google.com/search?q=" + input.replace(" ", "+");
        }
        narrate("Loading " + input);
        if (focusModeActive) {
            crossFade(focusListView, webView);
            focusModeActive = false;
        }
        webView.loadUrl(url);
    }

    /**
     * TTS narration. QUEUE_FLUSH interrupts any in-progress speech
     * so users always hear the most current message, never a backlog.
     */
    public void narrate(String text) {
        if (ttsReady && tts != null && text != null && !text.isEmpty()) {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null,
                    "cv_" + System.currentTimeMillis());
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  GESTURE: TWO-FINGER DOUBLE-TAP → Toggle Focus Mode
    // ══════════════════════════════════════════════════════════════

    /**
     * Intercepts all touch events before any View consumes them.
     * Counts two-finger ACTION_UP events; two within TWO_FINGER_SLOP
     * milliseconds triggers Focus Mode toggle.
     *
     * Why not GestureDetector.onDoubleTap?
     * GestureDetector counts pointer-count at the moment of the
     * callback, which is unreliable for multi-finger gestures.
     * Manually tracking ACTION_UP timestamps is more reliable.
     */
    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (event.getPointerCount() == 2
                && event.getActionMasked() == MotionEvent.ACTION_UP) {
            long now = System.currentTimeMillis();
            if (now - lastTwoFingerTap < TWO_FINGER_SLOP) {
                toggleFocusMode();
            }
            lastTwoFingerTap = now;
        }
        return super.dispatchTouchEvent(event);
    }

    // ══════════════════════════════════════════════════════════════
    //  GESTURE: SHAKE → Voice Search (SensorEventListener)
    // ══════════════════════════════════════════════════════════════

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) return;

        float magnitude = (float) Math.sqrt(
                event.values[0] * event.values[0] +
                event.values[1] * event.values[1] +
                event.values[2] * event.values[2]
        ) - SensorManager.GRAVITY_EARTH;

        if (magnitude > SHAKE_THRESHOLD) {
            long now = System.currentTimeMillis();
            if (now - lastShakeTime > SHAKE_COOLDOWN) {
                lastShakeTime = now;
                runOnUiThread(this::startVoiceSearch);
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { /* unused */ }

    // ══════════════════════════════════════════════════════════════
    //  CLIPBOARD BRIDGE
    // ══════════════════════════════════════════════════════════════

    /**
     * Checks clipboard on every resume for a copied URL.
     * If found, narrates a prompt and wires the mic button's long-press
     * to load it — eliminating the need for a visible address bar.
     */
    private void checkClipboardForUrl() {
        ClipboardManager clipboard =
                (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null || !clipboard.hasPrimaryClip()) return;
        ClipData clip = clipboard.getPrimaryClip();
        if (clip == null || clip.getItemCount() == 0) return;
        CharSequence text = clip.getItemAt(0).getText();
        if (text == null) return;

        String str = text.toString().trim();
        if (str.startsWith("http://") || str.startsWith("https://")
                || str.contains(".com") || str.contains(".org")) {
            narrate("Link found in clipboard. Long-press the microphone to load it.");
            voiceSearchButton.setOnLongClickListener(v -> {
                processVoiceInput(str);
                voiceSearchButton.setOnLongClickListener(null); // reset after one use
                return true;
            });
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  HAPTICS (MVP: link pulse + header pulse only)
    // ══════════════════════════════════════════════════════════════

    /** 40ms single buzz — confirms a link tap or minor interaction. */
    public void hapticLinkPulse() {
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(
                    40, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            //noinspection deprecation
            vibrator.vibrate(40);
        }
    }

    /** 150+150ms double buzz — confirms a page load or mode switch. */
    public void hapticHeaderPulse() {
        if (vibrator == null || !vibrator.hasVibrator()) return;
        long[] pattern = {0, 150, 80, 150};
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } else {
            //noinspection deprecation
            vibrator.vibrate(pattern, -1);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  UTILITIES
    // ══════════════════════════════════════════════════════════════

    /** Cross-fade animation between two views in the same FrameLayout slot. */
    private void crossFade(View out, View in) {
        AlphaAnimation fadeOut = new AlphaAnimation(1f, 0f);
        fadeOut.setDuration(160);
        out.startAnimation(fadeOut);
        out.setVisibility(View.GONE);

        in.setVisibility(View.VISIBLE);
        AlphaAnimation fadeIn = new AlphaAnimation(0f, 1f);
        fadeIn.setDuration(200);
        in.startAnimation(fadeIn);
    }

    /** Strips protocol and path — shows just the domain in the URL bar. */
    private String trimUrl(String url) {
        if (url == null) return "";
        return url.replaceFirst("https?://(www\\.)?", "")
                  .replaceAll("/.*", "");
    }

    /** Pulls an integer value from a flat JSON string by key name. */
    private int extractInt(String json, String key) {
        if (json == null) return 0;
        String search = "\"" + key + "\":";
        int i = json.indexOf(search);
        if (i < 0) return 0;
        int s = i + search.length(), e = s;
        while (e < json.length() && Character.isDigit(json.charAt(e))) e++;
        try { return Integer.parseInt(json.substring(s, e)); }
        catch (NumberFormatException ex) { return 0; }
    }
}
