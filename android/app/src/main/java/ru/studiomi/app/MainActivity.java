package ru.studiomi.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
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
import android.widget.Spinner;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.bottomsheet.BottomSheetDialog;

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

    private static final String FALLBACK_PHONE = "+79334304777";
    private static final String FALLBACK_DIKIDI = "https://dikidi.net/2049120?p=0.pi";

    private static final String APP_VERSION = "1.1";

    private static final String INJECT_JS = """
            (function(){
              var st=document.createElement('style');
              st.id='app-mask';
              st.textContent='header.header,footer.footer,#float-root,.mobile-cta{display:none!important}'
                +'body.has-mobile-cta{padding-bottom:0!important}';
              var head=document.head||document.getElementsByTagName('head')[0];
              var old=document.getElementById('app-mask'); if(old) old.remove();
              head.appendChild(st);
              window.__appGo=function(sec){
                try{
                  if(!sec||sec==='top'){window.scrollTo({top:0,behavior:'smooth'});return;}
                  var el=document.getElementById(sec);
                  if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
                }catch(e){}
              };
              if(!window.__appSpy){
                window.__appSpy=true;
                var ids=['promos','services','portfolio','contacts'];
                var t=null;
                window.addEventListener('scroll',function(){
                  if(t)return;
                  t=setTimeout(function(){
                    t=null;
                    try{
                      var y=window.scrollY+window.innerHeight*0.4, cur='home';
                      for(var i=0;i<ids.length;i++){
                        var el=document.getElementById(ids[i]);
                        if(el&&el.offsetTop<=y)cur=ids[i];
                      }
                      AppBridge.section(cur);
                    }catch(e){}
                  },150);
                },{passive:true});
              }
              try{
                AppBridge.config(JSON.stringify({
                  phone:(typeof CONFIG!=='undefined'&&CONFIG.phones&&CONFIG.phones[0])||'',
                  hook:(typeof CONFIG!=='undefined'&&CONFIG.leadWebhookUrl)||'',
                  diki:(typeof CONFIG!=='undefined'&&CONFIG.dikidiUrl)||'',
                  book:(typeof CONFIG!=='undefined'&&CONFIG.bookingUrl)||''
                }));
              }catch(e){}
              try{
                AppBridge.services(JSON.stringify(getServices().map(function(s){return s.title;})));
              }catch(e){}
            })();
            """;

    private WebView web;
    private SwipeRefreshLayout swipe;
    private View errorBox;
    private BottomNavigationView nav;
    private ValueCallback<Uri[]> fileCallback;

    private volatile String cfgPhone = FALLBACK_PHONE;
    private volatile String cfgHook = "";
    private volatile String cfgDiki = FALLBACK_DIKIDI;
    private volatile String cfgBook = "";
    private volatile List<String> serviceTitles = new ArrayList<>();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        swipe = findViewById(R.id.swipe);
        web = findViewById(R.id.web);
        errorBox = findViewById(R.id.error_box);
        nav = findViewById(R.id.nav);
        Button retry = findViewById(R.id.btn_retry);
        Button btnBook = findViewById(R.id.btn_book);
        androidx.appcompat.widget.Toolbar toolbar = findViewById(R.id.toolbar);

        toolbar.setOnMenuItemClickListener(this::onToolbarMenuItem);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

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
                swipe.setRefreshing(false);
                view.evaluateJavascript(INJECT_JS, null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
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

        swipe.setOnRefreshListener(() -> web.reload());

        retry.setOnClickListener(v -> {
            errorBox.setVisibility(View.GONE);
            web.reload();
        });

        btnBook.setOnClickListener(v -> showBookingSheet());

        nav.setOnItemSelectedListener(item -> {
            scrollToSection(item.getItemId());
            return true;
        });

        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web.canGoBack()) {
                    web.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(HOME_URL);
        }
    }

    private boolean onToolbarMenuItem(MenuItem item) {
        if (item.getItemId() == R.id.action_call) {
            openExternal(Uri.parse("tel:" + normalizedPhone()));
            return true;
        }
        return false;
    }

    private void scrollToSection(int itemId) {
        String sec;
        if (itemId == R.id.nav_home) sec = "top";
        else if (itemId == R.id.nav_services) sec = "services";
        else if (itemId == R.id.nav_promos) sec = "promos";
        else if (itemId == R.id.nav_works) sec = "portfolio";
        else if (itemId == R.id.nav_contacts) sec = "contacts";
        else return;
        web.evaluateJavascript("window.__appGo&&window.__appGo('" + sec + "')", null);
    }

    private int menuIdForSection(String sec) {
        if (sec == null) return -1;
        switch (sec) {
            case "home": return R.id.nav_home;
            case "promos": return R.id.nav_promos;
            case "services": return R.id.nav_services;
            case "portfolio": return R.id.nav_works;
            case "contacts": return R.id.nav_contacts;
            default: return -1;
        }
    }

    private void showError() {
        swipe.setRefreshing(false);
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

    private String normalizedPhone() {
        String digits = cfgPhone == null ? "" : cfgPhone.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return FALLBACK_PHONE;
        if (digits.startsWith("8")) digits = "7" + digits.substring(1);
        if (!digits.startsWith("7")) digits = "7" + digits;
        return "+" + digits;
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
                String p = o.optString("phone", "");
                if (!p.isEmpty()) cfgPhone = p;
                cfgHook = o.optString("hook", "");
                String d = o.optString("diki", "");
                if (!d.isEmpty()) cfgDiki = d;
                cfgBook = o.optString("book", "");
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
        public void section(String id) {
            runOnUiThread(() -> {
                int menuId = menuIdForSection(id);
                if (menuId != -1 && nav.getSelectedItemId() != menuId) {
                    nav.setSelectedItemId(menuId);
                }
            });
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
        web.saveState(outState);
    }
}
