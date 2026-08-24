package ru.studiomi.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.MenuItem;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import javax.net.ssl.HttpsURLConnection;

public class MainActivity extends AppCompatActivity {

    private static final String HOME_URL = "https://studiomi.ru/";
    private static final int FILE_CHOOSER_CODE = 101;

    private static final String APP_VERSION = "2.0";

    private static final String FALLBACK_PHONE_DISPLAY = "+7 (933) 430-47-77";
    private static final String FALLBACK_DIKIDI = "https://dikidi.net/2049120?p=0.pi";

    private static final String INJECT_JS = """
            (function(){
              var st=document.createElement('style');
              st.id='app-mask';
              st.textContent='header.header,footer.footer,#float-root,.mobile-cta{display:none!important}'
                +'body.has-mobile-cta{padding-bottom:0!important}';
              var head=document.head||document.getElementsByTagName('head')[0];
              var old=document.getElementById('app-mask'); if(old) old.remove();
              head.appendChild(st);

              window.__appInit=function(sec){
                try{
                  var el=document.getElementById(sec);
                  if(el) el.scrollIntoView(true);
                }catch(e){}
              };

              try{
                AppBridge.config(JSON.stringify({
                  phones:(typeof CONFIG!=='undefined'&&CONFIG.phones)||[],
                  schedule:(typeof CONFIG!=='undefined'&&CONFIG.schedule)||'',
                  address:(typeof CONFIG!=='undefined'&&CONFIG.address)||'',
                  hook:(typeof CONFIG!=='undefined'&&CONFIG.leadWebhookUrl)||'',
                  diki:(typeof CONFIG!=='undefined'&&CONFIG.dikidiUrl)||'',
                  book:(typeof CONFIG!=='undefined'&&CONFIG.bookingUrl)||''
                }));
              }catch(e){}
              try{
                AppBridge.services(JSON.stringify(getServices().map(function(s){return s.title;})));
              }catch(e){}
              try{
                AppBridge.promos(JSON.stringify(getPromos().map(function(p){
                  return {b:p.badge||'',t:p.tag||'',title:p.title||'',d:p.desc||'',n:p.note||''};
                })));
              }catch(e){}
            })();
            """;

    private BottomNavigationView nav;
    private View errorBox;
    private View pageHome;
    private FrameLayout pagesHolder;
    private ValueCallback<Uri[]> fileCallback;
    private boolean suppressNavSelection;

    private TextView homeSchedule;
    private TextView homeAddress;
    private LinearLayout promosRow;
    private androidx.appcompat.widget.Toolbar toolbar;

    private static class Page {
        final String section;
        final int navId;
        final int titleRes;
        WebView web;
        boolean loadedOnce;
        boolean ready;
        Page(String section, int navId, int titleRes) {
            this.section = section;
            this.navId = navId;
            this.titleRes = titleRes;
        }
    }

    private Page pServices;
    private Page pWorks;
    private Page pContacts;
    private Page activePage;

    private volatile List<String> cfgPhones = new ArrayList<>();
    private volatile String cfgHook = "";
    private volatile String cfgDiki = "";
    private volatile String cfgBook = "";
    private volatile List<String> serviceTitles = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        nav = findViewById(R.id.nav);
        errorBox = findViewById(R.id.error_box);
        pageHome = findViewById(R.id.page_home);
        pagesHolder = findViewById(R.id.pages_holder);
        Button retry = findViewById(R.id.btn_retry);
        Button btnBook = findViewById(R.id.btn_book);
        toolbar = findViewById(R.id.toolbar);
        homeSchedule = findViewById(R.id.home_schedule);
        homeAddress = findViewById(R.id.home_address);
        promosRow = findViewById(R.id.promos_row);

        pServices = new Page("services", R.id.nav_services, R.string.tab_services);
        pWorks = new Page("portfolio", R.id.nav_works, R.string.tab_works);
        pContacts = new Page("contacts", R.id.nav_contacts, R.string.tab_contacts);

        retry.setOnClickListener(v -> {
            errorBox.setVisibility(View.GONE);
            if (activePage != null && activePage.web != null) {
                activePage.ready = false;
                activePage.loadedOnce = false;
                activePage.web.loadUrl(HOME_URL);
            }
        });

        btnBook.setOnClickListener(v -> showBookingSheet());

        nav.setOnItemSelectedListener(item -> {
            if (suppressNavSelection) return true;
            if (item.getItemId() == R.id.action_call) {
                showCallDialog();
                return false;
            }
            showPage(item.getItemId());
            return true;
        });

        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView w = activePage == null ? null : activePage.web;
                if (w != null && w.canGoBack()) {
                    w.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });

        showPage(R.id.nav_home);
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void ensurePage(Page page) {
        if (page.web != null) return;

        WebView web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "AppBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (scheme == null) return false;
                switch (scheme) {
                    case "tel":
                    case "mailto":
                    case "sms":
                    case "geo":
                    case "intent":
                        openExternal(uri);
                        return true;
                }
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    String host = uri.getHost();
                    if (host != null && !isInternalHost(host)) {
                        openExternal(uri);
                        return true;
                    }
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(INJECT_JS, null);
                if (!page.ready) {
                    view.evaluateJavascript(
                            "window.__appInit&&window.__appInit('" + page.section + "')", null);
                    view.postDelayed(() -> {
                        page.ready = true;
                        if (activePage == page) {
                            page.web.setVisibility(View.VISIBLE);
                        }
                    }, 350);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && activePage == page) showError();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_CODE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        page.web = web;
        pagesHolder.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private void showPage(int navId) {
        String title = getString(R.string.app_name);
        Page target = null;

        if (navId == R.id.nav_home) {
            target = null;
        } else if (navId == R.id.nav_services) target = pServices;
        else if (navId == R.id.nav_works) target = pWorks;
        else if (navId == R.id.nav_contacts) target = pContacts;

        if (target == null) {
            if (activePage != null && activePage.web != null) {
                activePage.web.setVisibility(View.GONE);
            }
            activePage = null;
            pageHome.setVisibility(View.VISIBLE);
        } else {
            pageHome.setVisibility(View.GONE);
            hideOtherPages(target);
            ensurePage(target);
            if (!target.loadedOnce) {
                target.loadedOnce = true;
                target.ready = false;
                target.web.setVisibility(View.INVISIBLE);
                target.web.loadUrl(HOME_URL);
            } else {
                target.web.setVisibility(View.VISIBLE);
            }
            title = getString(target.titleRes);
            activePage = target;
        }
        toolbar.setTitle(title);
        errorBox.setVisibility(View.GONE);
    }

    private void hideOtherPages(Page except) {
        Page[] all = {pServices, pWorks, pContacts};
        for (Page p : all) {
            if (p != except && p.web != null) p.web.setVisibility(View.GONE);
        }
    }

    private void showError() {
        errorBox.setVisibility(View.VISIBLE);
    }

    private static boolean isInternalHost(String host) {
        return host.equals("studiomi.ru")
                || host.equals("www.studiomi.ru")
                || host.endsWith(".studiomi.ru")
                || host.equals("yandex.ru")
                || host.endsWith(".yandex.ru")
                || host.endsWith(".yastatic.net");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    private String normalizedPhone(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return "";
        if (digits.startsWith("8")) digits = "7" + digits.substring(1);
        if (!digits.startsWith("7")) digits = "7" + digits;
        return "+" + digits;
    }

    private void showCallDialog() {
        List<String> phones = new ArrayList<>(cfgPhones);
        if (phones.isEmpty()) phones.add(FALLBACK_PHONE_DISPLAY);
        String[] items = phones.toArray(new String[0]);
        new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.calling)
                .setItems(items, (d, which) ->
                        openExternal(Uri.parse("tel:" + normalizedPhone(items[which]))))
                .setNegativeButton(android.R.string.cancel, null)
                .show();
        revertNavSelection();
    }

    private void revertNavSelection() {
        int backTo = activePage == null ? R.id.nav_home : activePage.navId;
        if (nav.getSelectedItemId() != backTo) {
            suppressNavSelection = true;
            try {
                nav.setSelectedItemId(backTo);
            } finally {
                suppressNavSelection = false;
            }
        }
    }

    // ---------- Запись ----------

    private void showBookingSheet() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        View content = getLayoutInflater().inflate(R.layout.sheet_booking, null, false);
        dialog.setContentView(content);

        EditText etName = content.findViewById(R.id.et_name);
        EditText etPhone = content.findViewById(R.id.et_phone);
        EditText etTime = content.findViewById(R.id.et_time);
        EditText etComment = content.findViewById(R.id.et_comment);
        Spinner spService = content.findViewById(R.id.sp_service);
        Button btnSend = content.findViewById(R.id.btn_lead_send);
        Button btnOnline = content.findViewById(R.id.btn_online);

        List<String> items = new ArrayList<>();
        items.add("Пока не знаю — нужна консультация");
        synchronized (this) {
            items.addAll(serviceTitles);
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_item, items);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spService.setAdapter(adapter);

        btnSend.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            String phone = etPhone.getText().toString().trim();
            if (name.isEmpty() || phone.isEmpty()) {
                Toast.makeText(this, R.string.fill_fields, Toast.LENGTH_SHORT).show();
                return;
            }
            Object sel = spService.getSelectedItem();
            String service = sel == null ? "" : sel.toString();
            sendLead(dialog, name, phone, service,
                    etTime.getText().toString().trim(),
                    etComment.getText().toString().trim());
        });

        btnOnline.setOnClickListener(v -> {
            String url = !cfgBook.isEmpty() ? cfgBook : cfgDiki;
            if (!url.isEmpty()) openExternal(Uri.parse(url));
            dialog.dismiss();
        });

        dialog.show();
    }

    private void sendLead(BottomSheetDialog dialog, String name, String phone,
                          String service, String time, String comment) {
        if (cfgHook.isEmpty()) {
            Toast.makeText(this, R.string.sent_fail, Toast.LENGTH_LONG).show();
            return;
        }
        String hook = cfgHook;
        Toast.makeText(this, "Отправляю…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            boolean ok;
            try {
                JSONObject payload = new JSONObject();
                payload.put("name", name);
                payload.put("phone", phone);
                payload.put("service", service);
                payload.put("visit_time", time);
                payload.put("comment", comment);
                payload.put("_hp", "");
                payload.put("_ts", System.currentTimeMillis());
                payload.put("source", "android-app");
                payload.put("version", APP_VERSION);

                HttpsURLConnection c =
                        (HttpsURLConnection) new java.net.URL(hook).openConnection();
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json;charset=utf-8");
                c.setDoOutput(true);
                c.setConnectTimeout(10000);
                c.setReadTimeout(15000);
                try (OutputStream os = c.getOutputStream()) {
                    os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                }
                int code = c.getResponseCode();
                c.disconnect();
                ok = code >= 200 && code < 400;
            } catch (Exception e) {
                ok = false;
            }
            boolean finalOk = ok;
            runOnUiThread(() -> {
                if (finalOk) {
                    Toast.makeText(this, R.string.sent_ok, Toast.LENGTH_LONG).show();
                    dialog.dismiss();
                } else {
                    Toast.makeText(this, R.string.sent_fail, Toast.LENGTH_LONG).show();
                }
            });
        }).start();
    }

    // ---------- JS-мост ----------

    private class Bridge {
        @android.webkit.JavascriptInterface
        public void config(String json) {
            try {
                JSONObject o = new JSONObject(json);
                JSONArray phones = o.optJSONArray("phones");
                if (phones != null && phones.length() > 0) {
                    List<String> list = new ArrayList<>();
                    for (int i = 0; i < phones.length(); i++) list.add(phones.getString(i));
                    cfgPhones = list;
                }
                String sched = o.optString("schedule", "");
                String addr = o.optString("address", "");
                cfgHook = o.optString("hook", "");
                String d = o.optString("diki", "");
                if (!d.isEmpty()) cfgDiki = d;
                cfgBook = o.optString("book", "");
                runOnUiThread(() -> {
                    if (!sched.isEmpty()) homeSchedule.setText(sched);
                    if (!addr.isEmpty()) homeAddress.setText(addr);
                });
            } catch (Exception ignored) {
            }
        }

        @android.webkit.JavascriptInterface
        public void services(String json) {
            try {
                JSONArray arr = new JSONArray(json);
                List<String> list = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) list.add(arr.getString(i));
                synchronized (MainActivity.this) {
                    serviceTitles = list;
                }
            } catch (Exception ignored) {
            }
        }

        @android.webkit.JavascriptInterface
        public void promos(String json) {
            final List<JSONObject> list = new ArrayList<>();
            try {
                JSONArray arr = new JSONArray(json);
                for (int i = 0; i < arr.length(); i++) list.add(arr.getJSONObject(i));
            } catch (Exception ignored) {
                return;
            }
            runOnUiThread(() -> renderPromos(list));
        }
    }

    private void renderPromos(List<JSONObject> items) {
        promosRow.removeAllViews();
        LayoutInflater inf = getLayoutInflater();
        for (JSONObject o : items) {
            View card = inf.inflate(R.layout.item_promo, promosRow, false);
            ((TextView) card.findViewById(R.id.promo_badge)).setText(o.optString("b"));
            ((TextView) card.findViewById(R.id.promo_tag)).setText(o.optString("t"));
            ((TextView) card.findViewById(R.id.promo_title)).setText(o.optString("title"));
            ((TextView) card.findViewById(R.id.promo_desc)).setText(o.optString("d"));
            TextView note = card.findViewById(R.id.promo_note);
            String n = o.optString("n");
            note.setText(n);
            note.setVisibility(n.isEmpty() ? View.GONE : View.VISIBLE);
            card.setOnClickListener(v -> showBookingSheet());
            promosRow.addView(card);
        }
    }

    // ---------- Состояние ----------

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_CODE && fileCallback != null) {
            fileCallback.onReceiveValue(
                    WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
    }
}
